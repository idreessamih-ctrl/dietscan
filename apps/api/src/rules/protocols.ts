import { ProtocolRules } from "./types";

export interface ProtocolDefinition {
  slug: string;
  name: string;
  description: string;
  rules: ProtocolRules;
}

export const SEED_PROTOCOLS: Record<string, ProtocolDefinition> = {
  keto: {
    slug: "keto",
    name: "Keto",
    description: "High fat, very low carb, and moderate protein dietary protocol designed to induce ketosis.",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "milk"],
      banned_categories: ["grains", "high-carb", "sugars"],
      allowed_exceptions: ["stevia", "monk fruit", "erythritol"],
    },
  },
  carnivore: {
    slug: "carnivore",
    name: "Carnivore",
    description: "Animal products only, zero plant foods. Focuses strictly on meat, fish, eggs, and certain animal fats.",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "soy", "almond", "coconut", "vegetable oil", "olive oil"],
      banned_categories: ["grains", "vegetables", "fruits", "legumes", "nuts", "seeds", "plant-based"],
      allowed_exceptions: [],
    },
  },
  paleo: {
    slug: "paleo",
    name: "Paleo",
    description: "No grains, no dairy, no legumes, and no refined sugar. Emphasizes whole foods eaten by early humans.",
    rules: {
      banned_ingredients: ["sugar", "wheat flour", "corn syrup", "milk", "cheese", "yogurt", "soy", "peanuts", "beans", "lentils"],
      banned_categories: ["grains", "dairy", "legumes", "refined-sugars"],
      allowed_exceptions: ["honey", "maple syrup", "coconut sugar"],
    },
  },
  vegan: {
    slug: "vegan",
    name: "Vegan",
    description: "No animal products whatsoever. Strictly plant-based, excluding all meats, dairy, eggs, and animal derivatives.",
    rules: {
      banned_ingredients: ["beef", "pork", "chicken", "fish", "gelatin", "milk", "cheese", "butter", "honey", "eggs", "whey", "casein"],
      banned_categories: ["meat", "poultry", "seafood", "dairy", "animal-byproducts"],
      allowed_exceptions: [],
    },
  },
  whole30: {
    slug: "whole30",
    name: "Whole30",
    description: "A 30-day nutritional reset eliminating sugar, alcohol, grains, legumes, dairy, and processed additives.",
    rules: {
      banned_ingredients: ["sugar", "honey", "maple syrup", "stevia", "monk fruit", "erythritol", "alcohol", "wine", "beer", "wheat flour", "rice", "corn", "soy", "peanuts", "beans", "lentils", "milk", "cheese", "butter", "carrageenan", "msg", "sulfites"],
      banned_categories: ["sugars", "sweeteners", "alcohol", "grains", "legumes", "dairy", "processed-additives"],
      allowed_exceptions: ["coconut aminos", "ghee"],
    },
  },
};
