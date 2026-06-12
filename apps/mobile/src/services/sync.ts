import * as SecureStore from "expo-secure-store";
import { AppState, AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";
import { getDb } from "../lib/db";

const LAST_SYNC_KEY = "last_sync_timestamp";

/**
 * Checks if the device is online and can reach the internet.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && !!state.isInternetReachable;
}

/**
 * Pull reference data from the server and upsert it into local SQLite.
 */
export async function syncReferenceData(): Promise<void> {
  try {
    const lastSync = await SecureStore.getItemAsync(LAST_SYNC_KEY) || new Date(0).toISOString();
    console.log(`[Sync] Pulling reference data since ${lastSync}`);

    const db = await getDb();
    const newSyncTime = new Date().toISOString();

    // 1. Sync Products (Paginated)
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await api.get<{
        products: Array<{
          id: string;
          barcode: string;
          name: string;
          brand: string | null;
          ingredients_json: string | string[];
          nutrition_json: any;
          updated_at: string;
        }>;
        hasMore: boolean;
      }>(`/api/v1/sync/products?since=${encodeURIComponent(lastSync)}&offset=${offset}`);

      const { products, hasMore: more } = response.data;
      for (const prod of products) {
        const ingredientsStr = typeof prod.ingredients_json === "string"
          ? prod.ingredients_json
          : JSON.stringify(prod.ingredients_json);
        const nutritionStr = prod.nutrition_json
          ? (typeof prod.nutrition_json === "string" ? prod.nutrition_json : JSON.stringify(prod.nutrition_json))
          : "{}";

        await db.runAsync(
          `INSERT OR REPLACE INTO products (id, barcode, name, brand, ingredients_json, nutrition_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [prod.id, prod.barcode, prod.name, prod.brand, ingredientsStr, nutritionStr, prod.updated_at]
        );
      }

      offset += products.length;
      hasMore = more && products.length > 0;
    }

    // 2. Sync Protocols
    const protocolsRes = await api.get<{
      protocols: Array<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        rules_json: string | Record<string, any>;
        updated_at: string;
      }>;
    }>(`/api/v1/sync/protocols?since=${encodeURIComponent(lastSync)}`);

    for (const proto of protocolsRes.data.protocols) {
      const rulesStr = typeof proto.rules_json === "string"
        ? proto.rules_json
        : JSON.stringify(proto.rules_json);

      await db.runAsync(
        `INSERT OR REPLACE INTO dietary_protocols (id, slug, name, description, rules_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [proto.id, proto.slug, proto.name, proto.description, rulesStr, proto.updated_at]
      );
    }

    // 3. Sync Ingredients
    const ingredientsRes = await api.get<{
      ingredients: Array<{
        id: string;
        name: string;
        category: string;
        banned_by: string | string[];
        aliases: string | string[];
        updated_at: string;
      }>;
    }>(`/api/v1/sync/ingredients?since=${encodeURIComponent(lastSync)}`);

    for (const ing of ingredientsRes.data.ingredients) {
      const bannedByStr = typeof ing.banned_by === "string"
        ? ing.banned_by
        : JSON.stringify(ing.banned_by);
      const aliasesStr = typeof ing.aliases === "string"
        ? ing.aliases
        : JSON.stringify(ing.aliases);

      await db.runAsync(
        `INSERT OR REPLACE INTO ingredients (id, name, category, banned_by, aliases_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ing.id, ing.name, ing.category, bannedByStr, aliasesStr, ing.updated_at]
      );
    }

    // 4. Sync Articles
    const articlesRes = await api.get<{
      articles: Array<{
        id: string;
        slug: string;
        title: string;
        content: string;
        protocol_tags: string | string[];
        updated_at: string;
      }>;
    }>(`/api/v1/sync/articles?since=${encodeURIComponent(lastSync)}`);

    for (const art of articlesRes.data.articles) {
      const tagsStr = typeof art.protocol_tags === "string"
        ? art.protocol_tags
        : JSON.stringify(art.protocol_tags);

      await db.runAsync(
        `INSERT OR REPLACE INTO education_articles (id, slug, title, content, protocol_tags, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [art.id, art.slug, art.title, art.content, tagsStr, art.updated_at]
      );
    }

    // Save sync time
    await SecureStore.setItemAsync(LAST_SYNC_KEY, newSyncTime);
    console.log(`[Sync] Reference data sync completed successfully. Next sync threshold: ${newSyncTime}`);
  } catch (error) {
    console.error("[Sync] Reference data sync failed:", error);
  }
}

/**
 * Push offline-created user data (scans and journal entries) to the server.
 */
export async function pushUserData(): Promise<void> {
  try {
    const db = await getDb();

    // 1. Push scans
    const unsyncedScans = await db.getAllAsync<{
      id: string;
      product_id: string;
      protocol_slug: string;
      passed: number;
      violations_json: string;
      scanned_at: string;
    }>("SELECT id, product_id, protocol_slug, passed, violations_json, scanned_at FROM scans WHERE synced = 0");

    if (unsyncedScans.length > 0) {
      console.log(`[Sync] Pushing ${unsyncedScans.length} unsynced scans to server...`);
      const scansToPush = [];
      for (const scan of unsyncedScans) {
        const product = await db.getFirstAsync<{
          id: string;
          barcode: string;
          name: string;
          brand: string | null;
          ingredients_json: string;
          nutrition_json: string | null;
        }>("SELECT id, barcode, name, brand, ingredients_json, nutrition_json FROM products WHERE id = ?", [scan.product_id]);

        scansToPush.push({
          id: scan.id,
          product_id: scan.product_id,
          protocol_slug: scan.protocol_slug,
          passed: scan.passed === 1,
          violations_json: JSON.parse(scan.violations_json),
          scanned_at: scan.scanned_at,
          product: product ? {
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            ingredients_json: JSON.parse(product.ingredients_json),
            nutrition_json: JSON.parse(product.nutrition_json || "{}"),
          } : undefined,
        });
      }

      const response = await api.post<{ synced: number; errors: any[] }>("/api/v1/sync/scans", scansToPush);
      console.log(`[Sync] Scans push result: ${response.data.synced} synced successfully.`);

      // Mark successfully synced scans
      const successIds = unsyncedScans
        .filter(s => !response.data.errors.some(e => e.id === s.id))
        .map(s => s.id);

      for (const id of successIds) {
        await db.runAsync("UPDATE scans SET synced = 1 WHERE id = ?", [id]);
      }
    }

    // 2. Push journal
    const unsyncedJournal = await db.getAllAsync<{
      id: string;
      meal_type: string;
      compliance_score: number;
      created_at: string;
    }>("SELECT id, meal_type, compliance_score, created_at FROM meal_journal WHERE synced = 0");

    if (unsyncedJournal.length > 0) {
      console.log(`[Sync] Pushing ${unsyncedJournal.length} unsynced journal entries to server...`);
      const journalToPush = unsyncedJournal.map((entry) => ({
        id: entry.id,
        meal_type: entry.meal_type,
        compliance_score: entry.compliance_score,
        created_at: entry.created_at,
      }));

      const response = await api.post<{ synced: number; errors: any[] }>("/api/v1/sync/journal", journalToPush);
      console.log(`[Sync] Journal push result: ${response.data.synced} synced successfully.`);

      // Mark successfully synced journal entries
      const successIds = unsyncedJournal
        .filter(j => !response.data.errors.some(e => e.id === j.id))
        .map(j => j.id);

      for (const id of successIds) {
        await db.runAsync("UPDATE meal_journal SET synced = 1 WHERE id = ?", [id]);
      }
    }
  } catch (error) {
    console.error("[Sync] User data push failed:", error);
  }
}

/**
 * Runs a full unidirectional sync if online: push local data, then pull server updates.
 */
export async function runFullSync(): Promise<void> {
  const online = await isOnline();
  if (!online) {
    console.log("[Sync] Offline. Skipping sync.");
    return;
  }

  console.log("[Sync] Device online. Starting full sync...");
  await pushUserData();
  await syncReferenceData();
  console.log("[Sync] Full sync cycle finished.");
}

// Keep track of active sync listeners
let syncInterval: NodeJS.Timeout | null = null;
let appStateSubscription: any = null;

/**
 * Initializes auto-sync listening on app foreground and runs every 5 minutes.
 */
export function startAutoSync(): void {
  if (syncInterval) return;

  // Run sync immediately on startup
  runFullSync().catch(err => console.error("[Sync] Initial startup sync failed:", err));

  // Run sync every 5 minutes
  syncInterval = setInterval(() => {
    runFullSync().catch(err => console.error("[Sync] Interval sync failed:", err));
  }, 5 * 60 * 1000);

  // Run sync on app foregrounding
  appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
    if (nextAppState === "active") {
      console.log("[Sync] App returned to active foreground, running sync...");
      runFullSync().catch(err => console.error("[Sync] Foreground sync failed:", err));
    }
  });
}

/**
 * Clean up active sync listeners.
 */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
