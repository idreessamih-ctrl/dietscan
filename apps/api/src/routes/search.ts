import { Router } from "express";
import { meiliClient } from "../lib/meilisearch";
import { query } from "../lib/db";
import { cacheGet, cacheSet } from "../lib/cache";

const router = Router();

interface SearchResponse {
  hits: Record<string, unknown>[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
}

/**
 * GET /search/products (or GET /products under mounted route)
 * Search products index, filter by dietary compliance protocol
 */
router.get("/products", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const protocol = typeof req.query.protocol === "string" ? req.query.protocol : "";
    
    const limit = Math.min(
      req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      100
    );
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const cacheKey = `search:products:${q}:${protocol}:${limit}:${offset}`;
    const cached = await cacheGet<SearchResponse>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const options: { limit: number; offset: number; filter?: string } = {
      limit,
      offset,
    };

    if (protocol) {
      options.filter = `compliant_protocols = ${protocol}`;
    }

    const searchResult = await meiliClient.index("products").search(q, options);

    await cacheSet(cacheKey, searchResult, 300); // Cache for 5 minutes (300s)
    res.json(searchResult);
  } catch (error) {
    next(error);
  }
});

// Also define /search/products directly in case of mounting behavior
router.get("/search/products", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const protocol = typeof req.query.protocol === "string" ? req.query.protocol : "";
    
    const limit = Math.min(
      req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      100
    );
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const cacheKey = `search:products:${q}:${protocol}:${limit}:${offset}`;
    const cached = await cacheGet<SearchResponse>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const options: { limit: number; offset: number; filter?: string } = {
      limit,
      offset,
    };

    if (protocol) {
      options.filter = `compliant_protocols = ${protocol}`;
    }

    const searchResult = await meiliClient.index("products").search(q, options);

    await cacheSet(cacheKey, searchResult, 300);
    res.json(searchResult);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /alternatives (or GET /search/alternatives)
 * Find compliant alternatives to a failed product (same category, different brand, compliant)
 */
router.get("/alternatives", async (req, res, next) => {
  try {
    const productId = typeof req.query.productId === "string" ? req.query.productId : "";
    const protocolSlug = typeof req.query.protocolSlug === "string" ? req.query.protocolSlug : "";
    
    const limit = Math.min(
      req.query.limit ? parseInt(req.query.limit as string, 10) : 5,
      100
    );

    if (!productId || !protocolSlug) {
      res.status(400).json({ message: "productId and protocolSlug are required query parameters" });
      return;
    }

    const cacheKey = `search:alternatives:${productId}:${protocolSlug}:${limit}`;
    const cached = await cacheGet<Record<string, unknown>[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // 1. Fetch original product from PostgreSQL
    const productRes = await query<{ name: string; brand: string | null; nutrition_json: unknown }>(
      "SELECT name, brand, nutrition_json FROM products WHERE id = $1",
      [productId]
    );

    if (productRes.rows.length === 0) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const originalProduct = productRes.rows[0];
    let nutrition: Record<string, unknown> = {};

    if (originalProduct.nutrition_json && typeof originalProduct.nutrition_json === "object") {
      nutrition = originalProduct.nutrition_json as Record<string, unknown>;
    } else if (typeof originalProduct.nutrition_json === "string") {
      try {
        nutrition = JSON.parse(originalProduct.nutrition_json) as Record<string, unknown>;
      } catch {
        // ignore
      }
    }

    let category = "Unknown";
    if (typeof nutrition.category === "string") {
      category = nutrition.category;
    }

    // 2. Build filters for Meilisearch
    // Must be same category, different brand, and compliant with protocol
    const filters: string[] = [];
    filters.push(`category = "${category.replace(/"/g, '\\"')}"`);
    
    if (originalProduct.brand) {
      filters.push(`brand != "${originalProduct.brand.replace(/"/g, '\\"')}"`);
    }
    
    filters.push(`compliant_protocols = ${protocolSlug}`);

    const searchResult = await meiliClient.index("products").search("", {
      filter: filters.join(" AND "),
      limit,
    });

    await cacheSet(cacheKey, searchResult.hits, 300);
    res.json(searchResult.hits);
  } catch (error) {
    next(error);
  }
});

export default router;
