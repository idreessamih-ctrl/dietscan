import { api } from "../services/api";
import { evaluateCompliance } from "./complianceEngine";
import { ScanResult } from "../store/scanStore";

// Local cache to store product lookup results in memory
const localProductCache: Record<string, ScanResult> = {};

/**
 * Looks up a barcode by calling the backend proxy, runs the local compliance
 * checks on the returned ingredients list, and caches the result.
 */
export async function lookupBarcodeAndCheckCompliance(
  barcode: string,
  protocolSlug: string
): Promise<ScanResult | null> {
  const cacheKey = `${barcode}:${protocolSlug}`;

  // Return cached result if available
  if (localProductCache[cacheKey]) {
    return localProductCache[cacheKey];
  }

  try {
    console.log(`[BarcodeScanner] Looking up barcode: ${barcode}`);
    
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

    // Extract raw ingredients array
    const rawIngredients = product.ingredients_json || [];

    // Evaluate compliance locally
    const complianceReport = await evaluateCompliance(protocolSlug, rawIngredients);

    const scanResult: ScanResult = {
      barcode: product.barcode,
      name: product.name || "Unknown Product",
      brand: product.brand || null,
      ingredients: rawIngredients,
      complianceReport,
      nutritionFacts: product.nutrition_json || {},
      scannedAt: new Date().toISOString(),
    };

    // Store in local cache
    localProductCache[cacheKey] = scanResult;

    return scanResult;
  } catch (error) {
    console.error("[BarcodeScanner] Error looking up product barcode:", error);
    return null;
  }
}
