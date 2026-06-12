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

// Delegate the compliance evaluation function to ruleEngine.ts
export { evaluateCompliance } from "./ruleEngine";
