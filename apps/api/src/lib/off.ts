import { OpenFoodFacts } from "@openfoodfacts/openfoodfacts-nodejs";
import { valkey } from "./valkey";
import { query } from "./db";

export interface MappedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  ingredients_json: string[];
  nutrition_json: Record<string, unknown>;
}

/**
 * Looks up a product by barcode.
 * Uses Valkey caching: 24h for found products, 1h for not-found.
 * Rate-limits outgoing OFF API requests to 15 req/min.
 */
export async function lookupBarcode(barcode: string): Promise<MappedProduct | null> {
  const cacheKey = `product:${barcode}`;

  // 1. Check Valkey Cache
  const cachedVal = await valkey.get(cacheKey);
  if (cachedVal === "not-found") {
    return null;
  }
  if (cachedVal) {
    try {
      return JSON.parse(cachedVal) as MappedProduct;
    } catch {
      // In case of corrupted json, proceed to fetch
    }
  }

  // 2. Apply Rate Limit for OFF API Calls (15 req/min)
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 60);
  const rateLimitKey = `off_api_limit:${windowStart}`;

  const currentCount = await valkey.incr(rateLimitKey);
  if (currentCount === 1) {
    await valkey.expire(rateLimitKey, 60);
  }

  if (currentCount > 15) {
    throw new Error("Open Food Facts API rate limit exceeded (15 req/min). Please try again later.");
  }

  // 3. Query OFF API
  // Use globalThis.fetch as the fetch implementation
  const client = new OpenFoodFacts(globalThis.fetch);

  try {
    const result = await client.getProductV3(barcode);

    if (result.error || !result.data || result.data.status !== "success" || !result.data.product) {
      // Product not found or error, cache the not-found status for 1 hour
      await valkey.setex(cacheKey, 3600, "not-found");
      return null;
    }

    const rawProduct = result.data.product;

    // Map ingredients text/list to an array of ingredient names
    let ingredientsList: string[] = [];
    if (rawProduct.ingredients && Array.isArray(rawProduct.ingredients)) {
      ingredientsList = rawProduct.ingredients
        .map((i: unknown) => {
          const ing = i as { text?: unknown };
          return typeof ing.text === "string" ? ing.text.trim() : "";
        })
        .filter((t: string) => t !== "");
    } else if (typeof rawProduct.ingredients_text === "string") {
      ingredientsList = rawProduct.ingredients_text
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s !== "");
    }

    const brand = typeof rawProduct.brands === "string" ? rawProduct.brands.trim() : null;

    const mappedProduct: MappedProduct = {
      barcode,
      name: typeof rawProduct.product_name === "string" ? rawProduct.product_name.trim() : "Unknown Product",
      brand: brand || null,
      ingredients_json: ingredientsList,
      nutrition_json: (rawProduct.nutriments as unknown as Record<string, unknown>) || {},
    };

    // Cache product in Valkey for 24 hours
    await valkey.setex(cacheKey, 86400, JSON.stringify(mappedProduct));

    // Also persist in postgres 'products' table for relational scans
    await query(
      `INSERT INTO products (barcode, name, brand, ingredients_json, nutrition_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (barcode) DO UPDATE 
       SET name = EXCLUDED.name, brand = EXCLUDED.brand, ingredients_json = EXCLUDED.ingredients_json, nutrition_json = EXCLUDED.nutrition_json`,
      [
        mappedProduct.barcode,
        mappedProduct.name,
        mappedProduct.brand,
        JSON.stringify(mappedProduct.ingredients_json),
        JSON.stringify(mappedProduct.nutrition_json),
      ]
    );

    return mappedProduct;
  } catch (error) {
    console.error(`Error looking up barcode ${barcode}:`, error);
    // Handle error gracefully: return null on network/API issues
    return null;
  }
}
