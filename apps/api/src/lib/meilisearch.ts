import { MeiliSearch } from "meilisearch";
import { config } from "../config";

export const meiliClient = new MeiliSearch({
  host: config.MEILI_URL,
  apiKey: config.MEILI_MASTER_KEY,
});

export async function initMeilisearch() {
  try {
    // Ping to ensure connection
    const health = await meiliClient.health();
    console.log("[Meilisearch] Connected successfully, status:", health.status);

    // Initialize products index
    await meiliClient.index("products").updateSettings({
      searchableAttributes: ["name", "brand", "ingredients"],
      filterableAttributes: ["category", "brand", "compliant_protocols", "barcode", "id"],
      sortableAttributes: ["name"],
    });

    // Initialize ingredients index
    await meiliClient.index("ingredients").updateSettings({
      searchableAttributes: ["name", "category"],
      filterableAttributes: ["category", "banned_by", "id"],
      sortableAttributes: ["name"],
    });

    // Initialize articles index
    await meiliClient.index("articles").updateSettings({
      searchableAttributes: ["title", "content"],
      filterableAttributes: ["protocol_tags", "slug", "id"],
      sortableAttributes: ["title"],
    });

    console.log("[Meilisearch] Indexes and settings initialized successfully.");
  } catch (error) {
    console.error("[Meilisearch] Error connecting or initializing settings in Meilisearch:", error);
  }
}
