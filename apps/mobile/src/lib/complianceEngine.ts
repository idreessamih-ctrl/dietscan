import { getAllDbIngredients } from "../services/db";
import { EXCLUSIONS } from "../data/exclusions";

export interface Violation {
  ingredient: string;
  bannedIngredient: string;
  category: string;
  reason: string;
}

export interface ComplianceReport {
  passed: boolean;
  violations: Violation[];
  score: number;
}

export interface ProtocolRules {
  banned_ingredients: string[];
  banned_categories: string[];
  allowed_exceptions: string[];
}

export const PROTOCOLS: Record<
  string,
  { name: string; rules: ProtocolRules }
> = {
  keto: {
    name: "Keto",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "milk"],
      banned_categories: ["grains", "high-carb", "sugars"],
      allowed_exceptions: ["stevia", "monk fruit", "erythritol"],
    },
  },
  carnivore: {
    name: "Carnivore",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "soy", "almond", "coconut", "vegetable oil", "olive oil"],
      banned_categories: ["grains", "vegetables", "fruits", "legumes", "nuts", "seeds", "plant-based"],
      allowed_exceptions: [],
    },
  },
  paleo: {
    name: "Paleo",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "milk", "cheese", "yogurt", "soy", "peanuts", "beans", "lentils"],
      banned_categories: ["grains", "dairy", "legumes", "refined-sugars"],
      allowed_exceptions: ["honey", "maple syrup", "coconut sugar"],
    },
  },
  vegan: {
    name: "Vegan",
    rules: {
      banned_ingredients: ["beef", "pork", "chicken", "fish", "gelatin", "milk", "cheese", "butter", "honey", "eggs", "whey", "casein"],
      banned_categories: ["meat", "poultry", "seafood", "dairy", "animal-byproducts"],
      allowed_exceptions: [],
    },
  },
  whole30: {
    name: "Whole30",
    rules: {
      banned_ingredients: ["sugar", "honey", "maple syrup", "stevia", "monk fruit", "erythritol", "alcohol", "wine", "beer", "wheat flour", "rice", "corn", "soy", "peanuts", "beans", "lentils", "milk", "cheese", "butter", "carrageenan", "msg", "sulfites"],
      banned_categories: ["sugars", "sweeteners", "alcohol", "grains", "legumes", "dairy", "processed-additives"],
      allowed_exceptions: ["coconut aminos", "ghee"],
    },
  },
};

/**
 * Evaluates a list of ingredients against a dietary protocol.
 */
export async function evaluateCompliance(
  protocolSlug: string,
  ingredients: string[]
): Promise<ComplianceReport> {
  const protocol = PROTOCOLS[protocolSlug] || {
    name: "Unknown",
    rules: { banned_ingredients: [], banned_categories: [], allowed_exceptions: [] },
  };
  const { rules } = protocol;

  const dbIngredients = await getAllDbIngredients();

  const violations: Violation[] = [];
  const uniqueViolatedIngredients = new Set<string>();

  const allowedExceptionsLower = rules.allowed_exceptions.map((e) => e.toLowerCase());
  const bannedCategoriesLower = rules.banned_categories.map((c) => c.toLowerCase());
  const bannedIngredientsLower = rules.banned_ingredients.map((i) => i.toLowerCase());

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
