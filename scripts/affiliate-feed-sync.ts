import { query, pool } from "../apps/api/src/lib/db";
import { evaluateIngredients } from "../apps/api/src/rules/engine";
import { reindexAll } from "../apps/api/src/lib/indexer";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const sampleProducts = [
  {
    external_id: "SKU101",
    retailer_name: "iHerb",
    retailer_network: "Partnerize",
    retailer_url: "https://www.iherb.com",
    name: "Quest Protein Bar - Chocolate Chip Cookie Dough",
    brand: "Quest Nutrition",
    price: 24.99,
    affiliate_url: "https://www.iherb.com/pr/quest-nutrition-protein-bar-chocolate-chip-cookie-dough/sku101",
    barcode: "88888888101",
    ingredients: ["Milk Protein Isolate", "Whey Protein Isolate", "Soluble Corn Fiber", "Almonds", "Water", "Erythritol", "Natural Flavors", "Cocoa Butter", "Sea Salt", "Stevia Sweetener"],
    nutrition: {
      "energy-kcal_100g": 370,
      "proteins_100g": 33,
      "carbohydrates_100g": 37,
      "fat_100g": 15,
      "fiber_100g": 26,
      "salt_100g": 0.9
    }
  },
  {
    external_id: "SKU102",
    retailer_name: "Thrive Market",
    retailer_network: "CJ Affiliate",
    retailer_url: "https://thrivemarket.com",
    name: "Thrive Market Organic Almond Butter",
    brand: "Thrive Market",
    price: 8.99,
    affiliate_url: "https://thrivemarket.com/p/thrive-market-organic-almond-butter/sku102",
    barcode: "88888888102",
    ingredients: ["Organic Dry Roasted Almonds"],
    nutrition: {
      "energy-kcal_100g": 613,
      "proteins_100g": 21,
      "carbohydrates_100g": 19,
      "fat_100g": 55,
      "fiber_100g": 10,
      "salt_100g": 0.0
    }
  },
  {
    external_id: "SKU103",
    retailer_name: "Swanson Health",
    retailer_network: "FlexOffers",
    retailer_url: "https://swansonvitamins.com",
    name: "Swanson Organic Extra Virgin Coconut Oil",
    brand: "Swanson Organic",
    price: 12.99,
    affiliate_url: "https://swansonvitamins.com/p/swanson-organic-extra-virgin-coconut-oil/sku103",
    barcode: "88888888103",
    ingredients: ["Organic Extra Virgin Coconut Oil"],
    nutrition: {
      "energy-kcal_100g": 862,
      "proteins_100g": 0,
      "carbohydrates_100g": 0,
      "fat_100g": 100,
      "fiber_100g": 0,
      "salt_100g": 0.0
    }
  }
];

async function runSync() {
  console.log("[Affiliate Sync] Starting cron feed sync...");

  try {
    for (const feedProduct of sampleProducts) {
      console.log(`[Affiliate Sync] Normalizing and verifying: ${feedProduct.name}`);

      // 1. Ensure Retailer exists
      let retailerId: string;
      const retailerRes = await query<{ id: string }>(
        "SELECT id FROM affiliate_retailers WHERE name = $1",
        [feedProduct.retailer_name]
      );

      if (retailerRes.rows.length > 0) {
        retailerId = retailerRes.rows[0].id;
      } else {
        retailerId = generateUUID();
        await query(
          `INSERT INTO affiliate_retailers (id, name, network, base_url, commission_rate)
           VALUES ($1, $2, $3, $4, $5)`,
          [retailerId, feedProduct.retailer_name, feedProduct.retailer_network, feedProduct.retailer_url, 5.00]
        );
        console.log(`[Affiliate Sync] Registered new retailer: ${feedProduct.retailer_name}`);
      }

      // 2. Ensure Core Product exists
      let productId: string;
      const productRes = await query<{ id: string }>(
        "SELECT id FROM products WHERE barcode = $1",
        [feedProduct.barcode]
      );

      const ingredientsJson = JSON.stringify(feedProduct.ingredients);
      const nutritionJson = JSON.stringify(feedProduct.nutrition);

      if (productRes.rows.length > 0) {
        productId = productRes.rows[0].id;
        await query(
          `UPDATE products 
           SET name = $1, brand = $2, ingredients_json = $3, nutrition_json = $4
           WHERE id = $5`,
          [feedProduct.name, feedProduct.brand, ingredientsJson, nutritionJson, productId]
        );
      } else {
        productId = generateUUID();
        await query(
          `INSERT INTO products (id, barcode, name, brand, ingredients_json, nutrition_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [productId, feedProduct.barcode, feedProduct.name, feedProduct.brand, ingredientsJson, nutritionJson]
        );
        console.log(`[Affiliate Sync] Created core product entry for: ${feedProduct.name}`);
      }

      // 3. Ensure Affiliate Product entry exists
      const affiliateRes = await query<{ id: string }>(
        "SELECT id FROM affiliate_products WHERE retailer_id = $1 AND product_id = $2",
        [retailerId, productId]
      );

      if (affiliateRes.rows.length > 0) {
        await query(
          `UPDATE affiliate_products
           SET affiliate_url = $1, price = $2
           WHERE id = $3`,
          [feedProduct.affiliate_url, feedProduct.price, affiliateRes.rows[0].id]
        );
      } else {
        const affiliateId = generateUUID();
        await query(
          `INSERT INTO affiliate_products (id, retailer_id, product_id, affiliate_url, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [affiliateId, retailerId, productId, feedProduct.affiliate_url, feedProduct.price]
        );
        console.log(`[Affiliate Sync] Linked affiliate product: ${feedProduct.name}`);
      }
    }

    // 4. Trigger reindex
    console.log("[Affiliate Sync] Running Meilisearch reindexing...");
    await reindexAll();
    console.log("[Affiliate Sync] Reindexing completed.");

    console.log("[Affiliate Sync] Sync completed successfully!");
  } catch (error) {
    console.error("[Affiliate Sync] Error occurred during sync:", error);
  } finally {
    await pool.end();
  }
}

runSync();
