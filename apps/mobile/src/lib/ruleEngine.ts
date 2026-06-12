import { getDb } from "./db";
import { getAllDbIngredients } from "../services/db";
import { EXCLUSIONS } from "../data/exclusions";
import { Violation, ComplianceReport, ProtocolRules, PROTOCOLS } from "./complianceEngine";

/**
 * Fetches protocol rules from local SQLite, falling back to static rules if not found.
 */
export async function getProtocolRules(protocolSlug: string): Promise<{ name: string; rules: ProtocolRules }> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ name: string; rules_json: string }>(
      "SELECT name, rules_json FROM dietary_protocols WHERE slug = ?",
      [protocolSlug]
    );

    if (row && row.rules_json) {
      const parsedRules = JSON.parse(row.rules_json);
      return {
        name: row.name,
        rules: {
          banned_ingredients: parsedRules.banned_ingredients || [],
          banned_categories: parsedRules.banned_categories || [],
          allowed_exceptions: parsedRules.allowed_exceptions || [],
        },
      };
    }
  } catch (error) {
    console.warn(`[RuleEngine] SQLite protocol lookup failed for ${protocolSlug}, falling back to static config:`, error);
  }

  // Fallback to static rules
  const staticProto = PROTOCOLS[protocolSlug] || PROTOCOLS["keto"];
  return {
    name: staticProto.name,
    rules: staticProto.rules,
  };
}

/**
 * Evaluates a list of ingredients against a dietary protocol ruleset stored in local SQLite database.
 */
export async function evaluateCompliance(
  protocolSlug: string,
  ingredients: string[]
): Promise<ComplianceReport> {
  const { rules } = await getProtocolRules(protocolSlug);
  const dbIngredients = await getAllDbIngredients();

  const violations: Violation[] = [];
  const uniqueViolatedIngredients = new Set<string>();

  const allowedExceptionsLower = rules.allowed_exceptions.map((e) => e.toLowerCase().trim());
  const bannedCategoriesLower = rules.banned_categories.map((c) => c.toLowerCase().trim());
  const bannedIngredientsLower = rules.banned_ingredients.map((i) => i.toLowerCase().trim());

  for (const ingredient of ingredients) {
    const ingLower = ingredient.toLowerCase().trim();

    // 1. Check if it matches an allowed exception
    const isException = allowedExceptionsLower.some(
      (exc) => ingLower === exc || ingLower.includes(exc)
    );
    if (isException) {
      continue;
    }

    // 2. Check if it matches an exclusion phrase
    const isExcluded = EXCLUSIONS.some(
      (exc) => ingLower === exc || ingLower.includes(exc)
    );
    if (isExcluded) {
      continue;
    }

    // Find in local dictionary
    const dbIng = dbIngredients.find(
      (db) =>
        db.name.toLowerCase() === ingLower ||
        db.aliases.some((a) => a.toLowerCase() === ingLower)
    );

    if (dbIng) {
      const dbIngNameLower = dbIng.name.toLowerCase();
      const dbIngCategoryLower = dbIng.category.toLowerCase();

      // Check if category is banned
      const isBannedCategory = bannedCategoriesLower.includes(dbIngCategoryLower);
      // Check if ingredient name is banned
      const isBannedName = bannedIngredientsLower.some(
        (b) => b === dbIngNameLower || dbIngNameLower.includes(b)
      );
      // Check if it is explicitly flagged in bannedBy for this protocol
      const isBannedByField = dbIng.bannedBy.some(
        (p) => p.toLowerCase() === protocolSlug.toLowerCase()
      );

      if (isBannedCategory || isBannedName || isBannedByField) {
        let reason = "Banned ingredient";
        if (isBannedCategory) reason = "Banned category";

        violations.push({
          ingredient,
          bannedIngredient: dbIng.name,
          category: dbIng.category,
          reason,
        });
        uniqueViolatedIngredients.add(ingredient);
        continue;
      }
    } else {
      // 3. Fallback: check raw matching against protocol's banned list
      let matchedBanned: string | null = null;
      for (const banned of bannedIngredientsLower) {
        if (ingLower === banned || ingLower.includes(banned)) {
          matchedBanned = banned;
          break;
        }
      }

      if (matchedBanned) {
        violations.push({
          ingredient,
          bannedIngredient: matchedBanned,
          category: "unknown",
          reason: "Banned ingredient",
        });
        uniqueViolatedIngredients.add(ingredient);
      }
    }
  }

  const score =
    ingredients.length > 0
      ? Math.round(
          ((ingredients.length - uniqueViolatedIngredients.size) /
            ingredients.length) *
            100
        )
      : 100;

  return {
    passed: violations.length === 0,
    violations,
    score,
  };
}
