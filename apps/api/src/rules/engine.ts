import { Engine } from "json-rules-engine";
import { query } from "../lib/db";
import { SEED_PROTOCOLS } from "./protocols";
import { Violation, ComplianceReport, ProtocolRules } from "./types";
import { cacheGet, cacheSet } from "../lib/cache";

/**
 * Evaluates a list of ingredient strings against a dietary protocol.
 * Checks for banned ingredients, categories, fuzzy matches using aliases,
 * exclusions for false positives, and allowed exceptions.
 */
export async function evaluateIngredients(
  protocolSlug: string,
  ingredients: string[]
): Promise<ComplianceReport> {
  // 1. Load protocol rules (cache in Valkey, TTL 1h = 3600s)
  const cacheKey = `protocol_rules:${protocolSlug}`;
  let rules = await cacheGet<ProtocolRules>(cacheKey);

  if (!rules) {
    const protocolResult = await query<{ rules_json: unknown }>(
      "SELECT rules_json FROM dietary_protocols WHERE slug = $1",
      [protocolSlug]
    );

    if (protocolResult.rows.length > 0) {
      rules = protocolResult.rows[0].rules_json as ProtocolRules;
      await cacheSet(cacheKey, rules, 3600);
    } else if (SEED_PROTOCOLS[protocolSlug]) {
      rules = SEED_PROTOCOLS[protocolSlug].rules;
      await cacheSet(cacheKey, rules, 3600);
    } else {
      rules = { banned_ingredients: [], banned_categories: [], allowed_exceptions: [] };
    }
  }

  // 2. Fetch all ingredients, ingredient_aliases, and exclusion_list from the DB
  const ingredientsRes = await query<{ id: string; name: string; category: string; banned_by: unknown }>(
    "SELECT id, name, category, banned_by FROM ingredients"
  );
  const aliasesRes = await query<{ alias: string; ingredient_id: string }>(
    "SELECT alias, ingredient_id FROM ingredient_aliases"
  );
  const exclusionsRes = await query<{ phrase: string; ingredient_id: string }>(
    "SELECT phrase, ingredient_id FROM exclusion_list"
  );

  const dbIngredients = ingredientsRes.rows;
  const dbAliases = aliasesRes.rows;
  const dbExclusions = exclusionsRes.rows;

  // 3. Identify all ingredients that are banned under this protocol
  interface BannedIngInfo {
    name: string;
    category: string;
    aliases: string[];
    exclusions: string[];
    reason: string;
  }

  const bannedIngredientsMap = new Map<string, BannedIngInfo>();

  for (const ing of dbIngredients) {
    const ingNameLower = ing.name.toLowerCase();
    const ingCategoryLower = ing.category.toLowerCase();

    const bannedByArray = Array.isArray(ing.banned_by)
      ? ing.banned_by
      : typeof ing.banned_by === "string"
        ? (JSON.parse(ing.banned_by) as string[])
        : [];

    const isBannedByName = rules.banned_ingredients.some((b) => b.toLowerCase() === ingNameLower);
    const isBannedByCategory = rules.banned_categories.some((c) => c.toLowerCase() === ingCategoryLower);
    const isBannedByArray = bannedByArray.some((b: string) => b.toLowerCase() === protocolSlug.toLowerCase());

    if (isBannedByName || isBannedByCategory || isBannedByArray) {
      const reason = isBannedByCategory ? "Banned category" : "Banned ingredient";

      const ingAliases = dbAliases
        .filter((a) => a.ingredient_id === ing.id)
        .map((a) => a.alias);

      const ingExclusions = dbExclusions
        .filter((e) => e.ingredient_id === ing.id)
        .map((e) => e.phrase);

      bannedIngredientsMap.set(ing.id, {
        name: ing.name,
        category: ing.category,
        aliases: ingAliases,
        exclusions: ingExclusions,
        reason,
      });
    }
  }

  // Add protocol's banned_ingredients that are not represented in DB ingredients
  for (const bannedIngName of rules.banned_ingredients) {
    const isAlreadyInMap = Array.from(bannedIngredientsMap.values()).some(
      (b) => b.name.toLowerCase() === bannedIngName.toLowerCase()
    );
    if (!isAlreadyInMap) {
      bannedIngredientsMap.set(bannedIngName, {
        name: bannedIngName,
        category: "unknown",
        aliases: [],
        exclusions: [],
        reason: "Banned ingredient",
      });
    }
  }

  // 4. Initialize the rules engine
  const engine = new Engine();

  // Register the custom isBanned operator
  engine.addOperator("isBanned", (factValue: unknown, ruleValue: unknown) => {
    if (typeof factValue !== "string") return false;
    const normalizedInput = factValue.toLowerCase().trim();

    const rVal = ruleValue as {
      name: string;
      aliases: string[];
      exclusions: string[];
      allowedExceptions: string[];
    };

    const allowedExceptions = (rVal.allowedExceptions || []).map((e) => e.toLowerCase());
    const exclusions = (rVal.exclusions || []).map((e) => e.toLowerCase());
    const name = rVal.name.toLowerCase();
    const aliases = (rVal.aliases || []).map((a) => a.toLowerCase());

    // Check if ingredient is an allowed exception (e.g. stevia in keto)
    for (const exc of allowedExceptions) {
      if (normalizedInput === exc || normalizedInput.includes(exc)) {
        return false;
      }
    }

    // Check if ingredient matches an exclusion phrase (e.g. coconut milk for milk)
    for (const exc of exclusions) {
      if (normalizedInput === exc || normalizedInput.includes(exc)) {
        return false;
      }
    }

    // Check if input matches the banned ingredient name or its aliases
    const targets = [name, ...aliases];
    for (const target of targets) {
      if (normalizedInput === target || normalizedInput.includes(target)) {
        return true;
      }
    }

    return false;
  });

  // 5. Add rules to the engine for each banned ingredient
  for (const [, bannedIng] of bannedIngredientsMap) {
    engine.addRule({
      conditions: {
        all: [
          {
            fact: "ingredient",
            operator: "isBanned",
            value: {
              name: bannedIng.name,
              aliases: bannedIng.aliases,
              exclusions: bannedIng.exclusions,
              allowedExceptions: rules.allowed_exceptions,
            },
          },
        ],
      },
      event: {
        type: "violation",
        params: {
          bannedIngredient: bannedIng.name,
          category: bannedIng.category,
          reason: bannedIng.reason,
        },
      },
    });
  }

  // 6. Evaluate all ingredients
  const violations: Violation[] = [];
  const uniqueViolatedIngredients = new Set<string>();

  for (const ingredient of ingredients) {
    const { events } = await engine.run({ ingredient });
    if (events && events.length > 0) {
      uniqueViolatedIngredients.add(ingredient);
      for (const event of events) {
        if (event.params) {
          violations.push({
            ingredient,
            bannedIngredient: String(event.params.bannedIngredient),
            category: String(event.params.category),
            reason: String(event.params.reason),
          });
        }
      }
    }
  }

  const score = ingredients.length > 0
    ? Math.round(((ingredients.length - uniqueViolatedIngredients.size) / ingredients.length) * 100)
    : 100;

  const flaggedIngredients = Array.from(uniqueViolatedIngredients);
  const compliantIngredients = ingredients.filter(
    (ing) => !uniqueViolatedIngredients.has(ing)
  );

  return {
    passed: violations.length === 0,
    score,
    violations,
    compliantIngredients,
    flaggedIngredients,
  };
}
