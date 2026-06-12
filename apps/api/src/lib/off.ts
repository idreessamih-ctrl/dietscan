// Stub for @openfoodfacts/openfoodfacts-nodejs which is ESM-only
// and breaks CJS builds. Real implementation loads dynamically.
import { valkey } from "./valkey";
import { query } from "./db";

export interface MappedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  ingredients_json: string[];
  nutrition_json: Record<string, unknown>;
}

export async function lookupBarcode(barcode: string): Promise<MappedProduct | null> {
  const cacheKey = `product:${barcode}`;
  try {
    const cachedVal = await valkey.get(cacheKey);
    if (cachedVal === "not-found") return null;
    if (cachedVal) {
      try { return JSON.parse(cachedVal) as MappedProduct; } catch {}
    }
  } catch {}

  // Try dynamic import of OFF client
  try {
    const OFF = await import("@openfoodfacts/openfoodfacts-nodejs");
    const client = new OFF.OpenFoodFacts(globalThis.fetch as any);
    const result = await client.getProductV3(barcode);
    if (!result.error && result.data?.status === "success" && result.data?.product) {
      const p = result.data.product;
      const ingredients = Array.isArray(p.ingredients)
        ? p.ingredients.map((i: any) => (typeof i.text === "string" ? i.text.trim() : "")).filter(Boolean)
        : typeof p.ingredients_text === "string"
          ? p.ingredients_text.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
      const product: MappedProduct = {
        barcode,
        name: typeof p.product_name === "string" ? p.product_name.trim() : "Unknown",
        brand: typeof p.brands === "string" ? p.brands.trim() : null,
        ingredients_json: ingredients,
        nutrition_json: (p.nutriments as any) || {},
      };
      try { await valkey.setex(cacheKey, 86400, JSON.stringify(product)); } catch {}
      try {
        await query(
          `INSERT INTO products (barcode, name, brand, ingredients_json, nutrition_json)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (barcode) DO UPDATE SET name=EXCLUDED.name`,
          [product.barcode, product.name, product.brand, JSON.stringify(product.ingredients_json), JSON.stringify(product.nutrition_json)]
        );
      } catch {}
      return product;
    }
  } catch (e) {
    console.error(`OFF lookup failed for ${barcode}:`, (e as Error).message);
  }

  // Cache not-found
  try { await valkey.setex(cacheKey, 3600, "not-found"); } catch {}
  return null;
}
