import * as SQLite from "expo-sqlite";
import { INGREDIENTS } from "../data/ingredients";
import { EXCLUSIONS } from "../data/exclusions";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("dietscan.db");

    // Enable WAL and foreign keys
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        ingredients_json TEXT NOT NULL,
        nutrition_json TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dietary_protocols (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        rules_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        banned_by TEXT NOT NULL,
        aliases_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exclusion_list (
        id TEXT PRIMARY KEY,
        phrase TEXT UNIQUE NOT NULL,
        ingredient_id TEXT NOT NULL,
        FOREIGN KEY(ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        protocol_slug TEXT NOT NULL,
        passed INTEGER NOT NULL,
        violations_json TEXT NOT NULL,
        scanned_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meal_journal (
        id TEXT PRIMARY KEY,
        meal_type TEXT NOT NULL,
        product_id TEXT NOT NULL,
        compliance_score REAL NOT NULL,
        created_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS education_articles (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        protocol_tags TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Seed ingredients and exclusions if empty
    const countResult = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM ingredients"
    );

    if (!countResult || countResult.count === 0) {
      console.log("[DB] Seeding ingredients database...");
      const timestamp = new Date().toISOString();
      for (const ing of INGREDIENTS) {
        const id = generateUUID();
        await db.runAsync(
          "INSERT OR IGNORE INTO ingredients (id, name, category, banned_by, aliases_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            id,
            ing.name,
            ing.category,
            JSON.stringify(ing.bannedBy),
            JSON.stringify(ing.aliases),
            timestamp,
          ]
        );
      }
      
      // Also seed exclusions
      console.log("[DB] Seeding exclusions database...");
      for (const phrase of EXCLUSIONS) {
        // Find if we can link it to an ingredient
        const lowerPhrase = phrase.toLowerCase().trim();
        const ingMatch = INGREDIENTS.find(
          i => i.name.toLowerCase() === lowerPhrase || i.aliases.some(a => a.toLowerCase() === lowerPhrase)
        );
        let ingId = "";
        if (ingMatch) {
          const row = await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM ingredients WHERE name = ?",
            [ingMatch.name]
          );
          if (row) ingId = row.id;
        }

        if (!ingId) {
          // Fallback: use first ingredient ID or dummy ID
          const row = await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM ingredients LIMIT 1"
          );
          if (row) ingId = row.id;
        }

        if (ingId) {
          await db.runAsync(
            "INSERT OR IGNORE INTO exclusion_list (id, phrase, ingredient_id) VALUES (?, ?, ?)",
            [generateUUID(), phrase, ingId]
          );
        }
      }
      console.log("[DB] Seeding completed successfully.");
    }

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

export interface DbIngredient {
  id: string;
  name: string;
  category: string;
  bannedBy: string[];
  aliases: string[];
  updated_at: string;
}

export async function getAllDbIngredients(): Promise<DbIngredient[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      category: string;
      banned_by: string;
      aliases_json: string;
      updated_at: string;
    }>("SELECT id, name, category, banned_by, aliases_json, updated_at FROM ingredients");

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      bannedBy: JSON.parse(row.banned_by) as string[],
      aliases: JSON.parse(row.aliases_json) as string[],
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("[DB Error] Failed to get ingredients from SQLite:", error);
    return [];
  }
}

export interface LocalScan {
  id: string;
  product_id: string;
  protocol_slug: string;
  passed: number;
  violations_json: string;
  scanned_at: string;
  synced: number;
}

export interface LocalMealJournal {
  id: string;
  meal_type: string;
  product_id: string;
  compliance_score: number;
  created_at: string;
  synced: number;
}

export interface LocalProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  ingredients_json: string;
  nutrition_json: string | null;
  updated_at: string;
}

export async function saveProductLocally(product: {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  ingredients: string[];
  nutritionFacts: any;
}): Promise<void> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO products (id, barcode, name, brand, ingredients_json, nutrition_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.barcode,
      product.name,
      product.brand,
      JSON.stringify(product.ingredients),
      JSON.stringify(product.nutritionFacts || {}),
      timestamp,
    ]
  );
}

export async function saveScanLocally(scan: {
  id: string;
  product_id: string;
  protocol_slug: string;
  passed: boolean;
  violations: any[];
  scanned_at: string;
  synced: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO scans (id, product_id, protocol_slug, passed, violations_json, scanned_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      scan.id,
      scan.product_id,
      scan.protocol_slug,
      scan.passed ? 1 : 0,
      JSON.stringify(scan.violations),
      scan.scanned_at,
      scan.synced ? 1 : 0,
    ]
  );
}

