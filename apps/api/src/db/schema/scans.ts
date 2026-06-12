import { pgTable, uuid, varchar, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { products } from "./products";
import { dietaryProtocols } from "./protocols";

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    protocolSlug: varchar("protocol_slug", { length: 50 })
      .notNull()
      .references(() => dietaryProtocols.slug, { onDelete: "cascade" }),
    passed: boolean("passed").notNull(),
    violations: jsonb("violations").notNull().default([]),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_scans_user_id").on(table.userId),
    index("idx_scans_protocol_slug").on(table.protocolSlug),
  ]
);

export const scansRelations = relations(scans, ({ one }) => ({
  user: one(users, {
    fields: [scans.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [scans.productId],
    references: [products.id],
  }),
  protocol: one(dietaryProtocols, {
    fields: [scans.protocolSlug],
    references: [dietaryProtocols.slug],
  }),
}));
