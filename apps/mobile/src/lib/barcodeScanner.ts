import { api } from "../services/api";
import { evaluateCompliance } from "./complianceEngine";
import { ScanResult } from "../store/scanStore";
import { getDb, saveProductLocally, saveScanLocally, generateUUID } from "./db";
import { isOnline } from "../services/sync";

// Local cache to store product lookup results in memory
const localProductCache: Record<string, ScanResult> = {};

/**
 * Looks up a barcode by calling the backend proxy (if online) or querying local SQLite (if offline),
 * runs the local compliance checks on the returned ingredients list, saves the results to local DB, and caches them.
 */
export async function lookupBarcodeAndCheckCompliance(
  barcode: string,
  protocolSlug: string
): Promise<ScanResult | null> {
  const cacheKey = `${barcode}:${protocolSlug}`;

  // Return memory-cached result if available
  if (localProductCache[cacheKey]) {
    return localProductCache[cacheKey];
  }

  const db = await getDb();
  const online = await isOnline();

  if (online) {
    try {
      console.log(`[BarcodeScanner] Online lookup for barcode: ${barcode}`);
      
      // Call backend endpoint POST /products/lookup
      const response = await api.post<{
        barcode: string;
        name: string;
        brand: string | null;
        ingredients_json: string[];
        nutrition_json: Record<string, unknown>;
      }>("/products/lookup", { barcode });

      const product = response.data;
      if (!product) {
        return null;
      }

      // Check if product exists in local database to reuse its ID
      const existingProduct = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM products WHERE barcode = ?",
        [barcode]
      );
      const productId = existingProduct?.id || generateUUID();

      // Extract raw ingredients array
      const rawIngredients = product.ingredients_json || [];

      // Evaluate compliance locally
      const complianceReport = await evaluateCompliance(protocolSlug, rawIngredients);

      const scanResult: ScanResult = {
        id: generateUUID(), // Assign unique ID to scan
        barcode: product.barcode,
        name: product.name || "Unknown Product",
        brand: product.brand || null,
        ingredients: rawIngredients,
        complianceReport,
        nutritionFacts: product.nutrition_json || {},
        scannedAt: new Date().toISOString(),
      };

      // Save product and scan to SQLite locally (marked as synced=true)
      await saveProductLocally({
        id: productId,
        barcode: scanResult.barcode!,
        name: scanResult.name,
        brand: scanResult.brand,
        ingredients: scanResult.ingredients,
        nutritionFacts: scanResult.nutritionFacts,
      });

      await saveScanLocally({
        id: scanResult.id!,
        product_id: productId,
        protocol_slug: protocolSlug,
        passed: complianceReport.passed,
        violations: complianceReport.violations,
        scanned_at: scanResult.scannedAt,
        synced: true,
      });

      // Store in memory cache
      localProductCache[cacheKey] = scanResult;

      return scanResult;
    } catch (error) {
      console.error("[BarcodeScanner] Online lookup failed, falling back to local database...", error);
    }
  }

  // Offline / Fallback flow: query local SQLite
  try {
    console.log(`[BarcodeScanner] Offline lookup for barcode: ${barcode}`);
    const localProduct = await db.getFirstAsync<{
      id: string;
      barcode: string;
      name: string;
      brand: string | null;
      ingredients_json: string;
      nutrition_json: string | null;
    }>("SELECT id, barcode, name, brand, ingredients_json, nutrition_json FROM products WHERE barcode = ?", [barcode]);

    if (!localProduct) {
      console.log(`[BarcodeScanner] Barcode ${barcode} not found in local SQLite database.`);
      return null;
    }

    const ingredients = JSON.parse(localProduct.ingredients_json) as string[];
    const nutritionFacts = JSON.parse(localProduct.nutrition_json || "{}");
    const complianceReport = await evaluateCompliance(protocolSlug, ingredients);

    const scanResult: ScanResult = {
      id: generateUUID(),
      barcode: localProduct.barcode,
      name: localProduct.name,
      brand: localProduct.brand,
      ingredients,
      complianceReport,
      nutritionFacts,
      scannedAt: new Date().toISOString(),
    };

    // Save offline scan to local SQLite (marked as synced=false)
    await saveScanLocally({
      id: scanResult.id!,
      product_id: localProduct.id,
      protocol_slug: protocolSlug,
      passed: complianceReport.passed,
      violations: complianceReport.violations,
      scanned_at: scanResult.scannedAt,
      synced: false,
    });

    // Store in memory cache
    localProductCache[cacheKey] = scanResult;

    return scanResult;
  } catch (error) {
    console.error("[BarcodeScanner] Local DB barcode lookup failed:", error);
    return null;
  }
}
