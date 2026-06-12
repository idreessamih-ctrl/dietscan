\c dietscan_core;

-- Seed 50 Products
INSERT INTO products (barcode, name, brand, ingredients_json, nutrition_json) VALUES
-- Snack Category
('000000000001', 'Keto Almond Cookies', 'KetoDelight', '["almond flour", "butter", "monk fruit", "eggs", "vanilla"]'::jsonb, '{"category": "Snack", "calories": 150, "fat": 12, "carbs": 2, "protein": 4}'::jsonb),
('000000000002', 'Classic Chocolate Chip Cookies', 'SweetBites', '["wheat flour", "sugar", "butter", "chocolate chips", "eggs"]'::jsonb, '{"category": "Snack", "calories": 200, "fat": 10, "carbs": 25, "protein": 2}'::jsonb),
('000000000003', 'Beef Jerky', 'CarnivoreCave', '["beef", "salt", "water"]'::jsonb, '{"category": "Snack", "calories": 120, "fat": 3, "carbs": 0, "protein": 22}'::jsonb),
('000000000004', 'Sweet Teriyaki Jerky', 'TeriyakiFoods', '["beef", "sugar", "soy sauce", "salt"]'::jsonb, '{"category": "Snack", "calories": 140, "fat": 2, "carbs": 12, "protein": 18}'::jsonb),
('000000000005', 'Paleo Coconut Bars', 'PaleoBites', '["coconut flakes", "dates", "almonds"]'::jsonb, '{"category": "Snack", "calories": 180, "fat": 14, "carbs": 10, "protein": 3}'::jsonb),
('000000000006', 'Honey Oat Bars', 'NatureValley', '["oats", "sugar", "canola oil", "honey"]'::jsonb, '{"category": "Snack", "calories": 190, "fat": 7, "carbs": 29, "protein": 3}'::jsonb),
('000000000007', 'Almond Butter', 'NuttyFriends', '["almonds", "sea salt"]'::jsonb, '{"category": "Snack", "calories": 190, "fat": 18, "carbs": 6, "protein": 7}'::jsonb),
('000000000008', 'Peanut Butter', 'NuttyFriends', '["peanuts", "sea salt"]'::jsonb, '{"category": "Snack", "calories": 188, "fat": 16, "carbs": 7, "protein": 8}'::jsonb),
('000000000009', 'Pork Rinds', 'CrunchySnacks', '["pork skins", "lard", "salt"]'::jsonb, '{"category": "Snack", "calories": 160, "fat": 10, "carbs": 0, "protein": 18}'::jsonb),
('000000000010', 'Seaweed Snacks', 'OceanBreeze', '["seaweed", "sesame oil", "sea salt"]'::jsonb, '{"category": "Snack", "calories": 30, "fat": 2.5, "carbs": 1, "protein": 1}'::jsonb),
('000000000011', 'Potato Chips', 'CrispyCo', '["potatoes", "vegetable oil", "salt"]'::jsonb, '{"category": "Snack", "calories": 150, "fat": 10, "carbs": 15, "protein": 2}'::jsonb),
('000000000012', 'Sweet Potato Chips', 'HealthyCrisps', '["sweet potatoes", "coconut oil", "salt"]'::jsonb, '{"category": "Snack", "calories": 140, "fat": 8, "carbs": 16, "protein": 1.5}'::jsonb),
('000000000013', 'Macadamia Nuts', 'IslandNuts', '["macadamia nuts", "sea salt"]'::jsonb, '{"category": "Snack", "calories": 200, "fat": 22, "carbs": 4, "protein": 2}'::jsonb),
('000000000014', 'Cashew Butter', 'NuttyFriends', '["cashews"]'::jsonb, '{"category": "Snack", "calories": 190, "fat": 16, "carbs": 9, "protein": 5}'::jsonb),
('000000000015', 'Dark Chocolate 90%', 'CocoaCraft', '["cocoa mass", "cocoa butter", "sugar", "vanilla extract"]'::jsonb, '{"category": "Snack", "calories": 180, "fat": 17, "carbs": 5, "protein": 3}'::jsonb),
('000000000016', 'Milk Chocolate', 'CocoaCraft', '["sugar", "milk", "cocoa butter", "cocoa mass", "lecithin"]'::jsonb, '{"category": "Snack", "calories": 210, "fat": 12, "carbs": 24, "protein": 2}'::jsonb),

-- Meat Category
('000000000017', 'Grilled Chicken Breast', 'SimpleMeats', '["chicken breast", "olive oil", "salt"]'::jsonb, '{"category": "Meat", "calories": 165, "fat": 3.6, "carbs": 0, "protein": 31}'::jsonb),
('000000000018', 'Vegan Bacon', 'PlantedFoods', '["soy protein", "wheat gluten", "yeast extract", "natural smoke flavor"]'::jsonb, '{"category": "Meat", "calories": 80, "fat": 4.5, "carbs": 2, "protein": 8}'::jsonb),
('000000000019', 'Grass-fed Ribeye Steak', 'ButcherBox', '["beef"]'::jsonb, '{"category": "Meat", "calories": 290, "fat": 22, "carbs": 0, "protein": 24}'::jsonb),
('000000000020', 'Wild Caught Salmon', 'ButcherBox', '["salmon", "salt"]'::jsonb, '{"category": "Meat", "calories": 200, "fat": 13, "carbs": 0, "protein": 20}'::jsonb),
('000000000021', 'Pork Sausage', 'ButcherBox', '["pork", "water", "salt", "spices", "sage", "black paper"]'::jsonb, '{"category": "Meat", "calories": 250, "fat": 21, "carbs": 1, "protein": 14}'::jsonb),
('000000000022', 'Whole Eggs', 'FarmFresh', '["eggs"]'::jsonb, '{"category": "Meat", "calories": 70, "fat": 5, "carbs": 0.6, "protein": 6}'::jsonb),
('000000000023', 'Beef Meatballs', 'SimpleMeats', '["beef", "salt", "eggs"]'::jsonb, '{"category": "Meat", "calories": 220, "fat": 16, "carbs": 0, "protein": 18}'::jsonb),
('000000000024', 'Breaded Chicken Tenders', 'FrozenFoods', '["chicken", "wheat flour", "corn starch", "vegetable oil", "salt", "dextrose"]'::jsonb, '{"category": "Meat", "calories": 260, "fat": 13, "carbs": 20, "protein": 15}'::jsonb),
('000000000025', 'Smoked Bacon', 'PorkHeaven', '["pork", "water", "salt", "sugar", "sodium nitrite"]'::jsonb, '{"category": "Meat", "calories": 140, "fat": 12, "carbs": 1, "protein": 9}'::jsonb),
('000000000026', 'Tuna in Water', 'SeaFresh', '["tuna", "water", "salt"]'::jsonb, '{"category": "Meat", "calories": 90, "fat": 1, "carbs": 0, "protein": 20}'::jsonb),
('000000000027', 'Tuna in Soybean Oil', 'SeaFresh', '["tuna", "soybean oil", "salt"]'::jsonb, '{"category": "Meat", "calories": 160, "fat": 10, "carbs": 0, "protein": 18}'::jsonb),

-- Dairy Category
('000000000028', 'Cheddar Cheese', 'DairyGold', '["milk", "salt", "cheese cultures"]'::jsonb, '{"category": "Dairy", "calories": 110, "fat": 9, "carbs": 1, "protein": 7}'::jsonb),
('000000000029', 'Grass-fed Ghee', 'GheeLicious', '["clarified butter"]'::jsonb, '{"category": "Dairy", "calories": 120, "fat": 14, "carbs": 0, "protein": 0}'::jsonb),
('000000000030', 'Greek Yogurt', 'DairyGold', '["milk", "live cultures"]'::jsonb, '{"category": "Dairy", "calories": 130, "fat": 5, "carbs": 6, "protein": 15}'::jsonb),
('000000000031', 'Vegan Cheddar', 'PlantedFoods', '["water", "potato starch", "coconut oil", "yeast extract", "beta-carotene"]'::jsonb, '{"category": "Dairy", "calories": 90, "fat": 7, "carbs": 6, "protein": 0}'::jsonb),
('000000000032', 'Organic Butter', 'DairyGold', '["milk", "salt"]'::jsonb, '{"category": "Dairy", "calories": 100, "fat": 11, "carbs": 0, "protein": 0}'::jsonb),
('000000000033', 'Cream Cheese', 'DairyGold', '["milk", "cream", "salt", "carob bean gum"]'::jsonb, '{"category": "Dairy", "calories": 100, "fat": 10, "carbs": 2, "protein": 2}'::jsonb),

-- Beverage Category
('000000000034', 'Vegan Protein Shake', 'GreenPure', '["pea protein", "almond milk", "stevia", "cocoa"]'::jsonb, '{"category": "Beverage", "calories": 120, "fat": 3, "carbs": 2, "protein": 20}'::jsonb),
('000000000035', 'Whey Protein Powder', 'MuscleMax', '["whey protein concentrate", "cocoa", "soy lecithin"]'::jsonb, '{"category": "Beverage", "calories": 130, "fat": 2, "carbs": 3, "protein": 25}'::jsonb),
('000000000036', 'Coconut Milk Drink', 'ThaiOrganic', '["coconut extract", "water"]'::jsonb, '{"category": "Beverage", "calories": 45, "fat": 4.5, "carbs": 1, "protein": 0.5}'::jsonb),
('000000000037', 'Organic Oat Milk', 'OatlyMe', '["oat base", "water", "rapeseed oil", "salt"]'::jsonb, '{"category": "Beverage", "calories": 120, "fat": 5, "carbs": 16, "protein": 2}'::jsonb),
('000000000038', 'Classic Kombucha', 'BochaBros', '["tea", "sugar", "kombucha culture"]'::jsonb, '{"category": "Beverage", "calories": 60, "fat": 0, "carbs": 14, "protein": 0}'::jsonb),
('000000000039', 'Sparkling Water', 'FizzCo', '["carbonated water", "natural flavor"]'::jsonb, '{"category": "Beverage", "calories": 0, "fat": 0, "carbs": 0, "protein": 0}'::jsonb),
('000000000040', 'Black Coffee', 'RoastMasters', '["coffee beans", "water"]'::jsonb, '{"category": "Beverage", "calories": 2, "fat": 0, "carbs": 0, "protein": 0.2}'::jsonb),
('000000000041', 'Green Tea', 'TeasOfJapan', '["green tea leaves", "water"]'::jsonb, '{"category": "Beverage", "calories": 0, "fat": 0, "carbs": 0, "protein": 0}'::jsonb),

-- Bakery/Bread Category
('000000000042', 'Keto Seed Bread', 'LowCarbBaking', '["water", "almond flour", "wheat gluten", "yeast"]'::jsonb, '{"category": "Bakery", "calories": 90, "fat": 6, "carbs": 2, "protein": 7}'::jsonb),
('000000000043', 'Sourdough Loaf', 'ArtisanBakers', '["wheat flour", "water", "salt", "yeast"]'::jsonb, '{"category": "Bakery", "calories": 120, "fat": 0.5, "carbs": 24, "protein": 4}'::jsonb),
('000000000044', 'Gluten Free Toast', 'FreeBaking', '["rice flour", "tapioca starch", "water", "egg whites", "sugar"]'::jsonb, '{"category": "Bakery", "calories": 110, "fat": 1.5, "carbs": 22, "protein": 2}'::jsonb),
('000000000045', 'Whole Wheat Bun', 'ArtisanBakers', '["whole wheat flour", "water", "honey", "yeast", "salt"]'::jsonb, '{"category": "Bakery", "calories": 140, "fat": 1.5, "carbs": 27, "protein": 5}'::jsonb),

-- Condiment/Other Category
('000000000046', 'Coconut Aminos Sauce', 'CocoSauce', '["coconut sap", "sea salt"]'::jsonb, '{"category": "Condiment", "calories": 30, "fat": 0, "carbs": 6, "protein": 0}'::jsonb),
('000000000047', 'Organic Guacamole', 'DipExpress', '["avocado", "lime juice", "cilantro", "salt"]'::jsonb, '{"category": "Condiment", "calories": 90, "fat": 8, "carbs": 3, "protein": 1}'::jsonb),
('000000000048', 'Mild Tomato Salsa', 'DipExpress', '["tomatoes", "onions", "jalapenos", "cilantro", "garlic", "salt"]'::jsonb, '{"category": "Condiment", "calories": 15, "fat": 0, "carbs": 3, "protein": 0.5}'::jsonb),
('000000000049', 'Soybean Mayo', 'CondiKing', '["soybean oil", "eggs", "vinegar", "salt", "sugar"]'::jsonb, '{"category": "Condiment", "calories": 90, "fat": 10, "carbs": 1, "protein": 0.1}'::jsonb),
('000000000050', 'Avocado Oil Mayonnaise', 'PrimalCondiments', '["avocado oil", "egg yolks", "vinegar", "salt", "rosemary extract"]'::jsonb, '{"category": "Condiment", "calories": 100, "fat": 11, "carbs": 0, "protein": 0}'::jsonb);
