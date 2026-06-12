export interface Violation {
  ingredient: string;
  bannedIngredient: string;
  category: string;
  reason: string;
}

export interface ComplianceReport {
  passed: boolean;
  score: number;
  violations: Violation[];
  compliantIngredients: string[];
  flaggedIngredients: string[];
}

export interface ProtocolRules {
  banned_ingredients: string[];
  banned_categories: string[];
  allowed_exceptions: string[];
}
