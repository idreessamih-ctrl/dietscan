import { query } from "./db";
import { meiliClient } from "./meilisearch";
import { evaluateIngredients } from "../rules/engine";

export interface ProductDbRow {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  ingredients_json: unknown;
  nutrition_json: unknown;
}

export async function mapProductToDoc(product: ProductDbRow, protocolSlugs: string[]) {
  let ingredients: string[] = [];
  if (Array.isArray(product.ingredients_json)) {
    ingredients = product.ingredients_json as string[];
  } else if (typeof product.ingredients_json === "string") {
    try {
      ingredients = JSON.parse(product.ingredients_json) as string[];
    } catch {
      // ignore
    }
  }

  let nutrition: Record<string, unknown> = {};
  if (product.nutrition_json && typeof product.nutrition_json === "object" && product.nutrition_json !== null) {
    nutrition = product.nutrition_json as Record<string, unknown>;
  } else if (typeof product.nutrition_json === "string") {
    try {
      nutrition = JSON.parse(product.nutrition_json) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }

  // Determine category of the product. Extract from nutrition if available.
  let category = "Unknown";
  if (typeof nutrition.category === "string") {
    category = nutrition.category;
  }

  // Calculate compliance for all protocols
  const compliant_protocols: string[] = [];
  for (const slug of protocolSlugs) {
    try {
      const report = await evaluateIngredients(slug, ingredients);
      if (report.passed) {
        compliant_protocols.push(slug);
      }
    } catch (error) {
      console.error(`[Indexer] Error evaluating compliance for product ${product.id} protocol ${slug}:`, error);
    }
  }

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    ingredients,
    nutrition,
    category,
    compliant_protocols,
  };
}

export async function indexProduct(product: ProductDbRow): Promise<void> {
  const protocolRes = await query<{ slug: string }>("SELECT slug FROM dietary_protocols");
  const protocolSlugs = protocolRes.rows.length > 0 
    ? protocolRes.rows.map(r => r.slug) 
    : ["keto", "carnivore", "paleo", "vegan", "whole30"];

  const doc = await mapProductToDoc(product, protocolSlugs);
  await meiliClient.index("products").addDocuments([doc]);
}

export async function indexProducts(products: ProductDbRow[]): Promise<void> {
  const protocolRes = await query<{ slug: string }>("SELECT slug FROM dietary_protocols");
  const protocolSlugs = protocolRes.rows.length > 0 
    ? protocolRes.rows.map(r => r.slug) 
    : ["keto", "carnivore", "paleo", "vegan", "whole30"];

  const docs = [];
  for (const product of products) {
    const doc = await mapProductToDoc(product, protocolSlugs);
    docs.push(doc);
  }
  if (docs.length > 0) {
    await meiliClient.index("products").addDocuments(docs);
  }
}

export async function reindexAll(): Promise<void> {
  // 1. Fetch all products from PostgreSQL
  const productsRes = await query<ProductDbRow>(
    "SELECT id, barcode, name, brand, ingredients_json, nutrition_json FROM products"
  );
  
  // 2. Fetch all ingredients from PostgreSQL and index them
  const ingredientsRes = await query<{ id: string; name: string; category: string; banned_by: unknown }>(
    "SELECT id, name, category, banned_by FROM ingredients"
  );
  const ingredientDocs = ingredientsRes.rows.map(row => {
    let banned_by: string[] = [];
    if (Array.isArray(row.banned_by)) {
      banned_by = row.banned_by as string[];
    } else if (typeof row.banned_by === "string") {
      try {
        banned_by = JSON.parse(row.banned_by) as string[];
      } catch {
        // ignore
      }
    }
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      banned_by,
    };
  });

  // 3. Fetch all articles from PostgreSQL and index them
  const articlesRes = await query<{ id: string; slug: string; title: string; content: string; protocol_tags: string[] }>(
    "SELECT id, slug, title, content, protocol_tags FROM education_articles"
  );
  const articleDocs = articlesRes.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content,
    protocol_tags: row.protocol_tags,
  }));

  // Index everything in Meilisearch
  if (ingredientDocs.length > 0) {
    await meiliClient.index("ingredients").addDocuments(ingredientDocs);
  }
  if (articleDocs.length > 0) {
    await meiliClient.index("articles").addDocuments(articleDocs);
  }

  // Index products
  await indexProducts(productsRes.rows);
}
