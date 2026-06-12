\c dietscan_core;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define custom ENUM types
CREATE TYPE meal_type_enum AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- 1. dietary_protocols
CREATE TABLE dietary_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    dietary_protocol VARCHAR(50) REFERENCES dietary_protocols(slug) ON DELETE SET NULL,
    push_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. ingredients
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    banned_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ingredient_aliases
CREATE TABLE ingredient_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    alias VARCHAR(255) UNIQUE NOT NULL
);

-- 5. exclusion_list
CREATE TABLE exclusion_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase VARCHAR(255) UNIQUE NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 6. products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    ingredients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    nutrition_json JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. scans
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    protocol_slug VARCHAR(50) NOT NULL REFERENCES dietary_protocols(slug) ON DELETE CASCADE,
    passed BOOLEAN NOT NULL,
    violations JSONB NOT NULL DEFAULT '[]'::jsonb,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. meal_journal
CREATE TABLE meal_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_type meal_type_enum NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    compliance_score NUMERIC(5, 2) NOT NULL CHECK (compliance_score >= 0.00 AND compliance_score <= 100.00)
);

-- 9. meal_plans
CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    protocol_slug VARCHAR(50) NOT NULL REFERENCES dietary_protocols(slug) ON DELETE CASCADE
);

-- 10. meal_plan_entries
CREATE TABLE meal_plan_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    meal_type meal_type_enum NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

-- 11. shopping_lists
CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

-- 12. shopping_list_items
CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    checked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 13. education_articles
CREATE TABLE education_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    protocol_tags TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. affiliate_retailers
CREATE TABLE affiliate_retailers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    network VARCHAR(100) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0.00 AND commission_rate <= 100.00)
);

-- 15. affiliate_products
CREATE TABLE affiliate_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES affiliate_retailers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    affiliate_url TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0.00)
);

-- 16. affiliate_clicks
CREATE TABLE affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES affiliate_retailers(id) ON DELETE CASCADE,
    click_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. affiliate_conversions
CREATE TABLE affiliate_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    click_id VARCHAR(255) NOT NULL REFERENCES affiliate_clicks(click_id) ON DELETE CASCADE,
    order_id VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0.00),
    commission NUMERIC(10, 2) NOT NULL CHECK (commission >= 0.00),
    status VARCHAR(50) NOT NULL
);

-- Create optimization indexes
CREATE INDEX idx_dietary_protocols_slug ON dietary_protocols(slug);
CREATE INDEX idx_users_dietary_protocol ON users(dietary_protocol);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_protocol_slug ON scans(protocol_slug);
CREATE INDEX idx_meal_journal_user_id ON meal_journal(user_id);
CREATE INDEX idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX idx_meal_plans_protocol_slug ON meal_plans(protocol_slug);
CREATE INDEX idx_meal_plan_entries_user_id ON meal_plan_entries(user_id);
CREATE INDEX idx_shopping_lists_user_id ON shopping_lists(user_id);
CREATE INDEX idx_education_articles_slug ON education_articles(slug);
CREATE INDEX idx_affiliate_clicks_user_id ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_click_id ON affiliate_clicks(click_id);
