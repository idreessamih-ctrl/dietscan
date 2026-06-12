\c dietscan_core;

-- Seed Dietary Protocols
INSERT INTO dietary_protocols (slug, name, description, rules_json) VALUES
('keto', 'Keto', 'High fat, very low carb, and moderate protein dietary protocol designed to induce ketosis.', 
 '{
   "banned_ingredients": ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "milk"],
   "banned_categories": ["grains", "high-carb", "sugars"],
   "allowed_exceptions": ["stevia", "monk fruit", "erythritol"]
 }'::jsonb),

('carnivore', 'Carnivore', 'Animal products only, zero plant foods. Focuses strictly on meat, fish, eggs, and certain animal fats.', 
 '{
   "banned_ingredients": ["sugar", "wheat flour", "corn syrup", "rice", "potatoes", "honey", "maple syrup", "soy", "almond", "coconut", "vegetable oil", "olive oil"],
   "banned_categories": ["grains", "vegetables", "fruits", "legumes", "nuts", "seeds", "plant-based"],
   "allowed_exceptions": []
 }'::jsonb),

('paleo', 'Paleo', 'No grains, no dairy, no legumes, and no refined sugar. Emphasizes whole foods eaten by early humans.', 
 '{
   "banned_ingredients": ["sugar", "wheat flour", "corn syrup", "milk", "cheese", "yogurt", "soy", "peanuts", "beans", "lentils"],
   "banned_categories": ["grains", "dairy", "legumes", "refined-sugars"],
   "allowed_exceptions": ["honey", "maple syrup", "coconut sugar"]
 }'::jsonb),

('vegan', 'Vegan', 'No animal products whatsoever. Strictly plant-based, excluding all meats, dairy, eggs, and animal derivatives.', 
 '{
   "banned_ingredients": ["beef", "pork", "chicken", "fish", "gelatin", "milk", "cheese", "butter", "honey", "eggs", "whey", "casein"],
   "banned_categories": ["meat", "poultry", "seafood", "dairy", "animal-byproducts"],
   "allowed_exceptions": []
 }'::jsonb),

('whole30', 'Whole30', 'A 30-day nutritional reset eliminating sugar, alcohol, grains, legumes, dairy, and processed additives.', 
 '{
   "banned_ingredients": ["sugar", "honey", "maple syrup", "stevia", "monk fruit", "erythritol", "alcohol", "wine", "beer", "wheat flour", "rice", "corn", "soy", "peanuts", "beans", "lentils", "milk", "cheese", "butter", "carrageenan", "msg", "sulfites"],
   "banned_categories": ["sugars", "sweeteners", "alcohol", "grains", "legumes", "dairy", "processed-additives"],
   "allowed_exceptions": ["coconut aminos", "ghee"]
 }'::jsonb);

-- Seed 20 Education Articles
INSERT INTO education_articles (slug, title, content, protocol_tags) VALUES
('what-is-keto', 'What is Keto?', 
 'The Ketogenic Diet is a very low-carb, high-fat diet that shares many similarities with the Atkins and low-carb diets. It involves drastically reducing carbohydrate intake and replacing it with fat. This reduction in carbs puts your body into a metabolic state called ketosis. When this happens, your body becomes incredibly efficient at burning fat for energy. It also turns fat into ketones in the liver, which can supply energy for the brain.', 
 ARRAY['keto']),

('what-is-carnivore', 'What is Carnivore?', 
 'The Carnivore Diet is a restrictive diet that includes only meat, fish, and other animal foods like eggs and certain dairy products. It excludes all other foods, including fruits, vegetables, legumes, grains, seeds, and nuts. Proponents claim that eliminating plant foods can help with weight loss, mood regulation, and autoimmune issues, attributing these benefits to the complete removal of plant toxins and allergens.', 
 ARRAY['carnivore']),

('what-is-paleo', 'What is Paleo?', 
 'A paleolithic diet is a dietary plan based on foods similar to what might have been eaten during the Paleolithic era, which dates from approximately 2.5 million to 10,000 years ago. A paleolithic diet typically includes lean meats, fish, fruits, vegetables, nuts and seeds — foods that in the past could be obtained by hunting and gathering. It limits foods that became common when farming emerged about 10,000 years ago, such as dairy products, legumes and grains.', 
 ARRAY['paleo']),

('what-is-vegan', 'What is Vegan?', 
 'Veganism is a way of living which seeks to exclude, as far as is possible and practicable, all forms of exploitation of, and cruelty to, animals for food, clothing or any other purpose. A vegan diet is entirely plant-based, relying on grains, seeds, nuts, legumes, vegetables, and fruits, while strictly avoiding meat, poultry, seafood, dairy, eggs, honey, and any ingredients derived from animal processing.', 
 ARRAY['vegan']),

('what-is-whole30', 'What is Whole30?', 
 'The Whole30 is a 30-day dietary program designed to reset your health, habits, and relationship with food. It focuses on whole, unprocessed foods while completely eliminating sugar, alcohol, grains, legumes, dairy, and common food additives like MSG and carrageenan. By stripping out these potentially inflammatory food groups for 30 days, participants can identify which foods might be negatively affecting their energy, digestion, skin, and overall well-being.', 
 ARRAY['whole30']),

('how-to-read-food-labels', 'How to Read Food Labels', 
 'Reading food labels effectively is key to maintaining compliance on any dietary protocol. Always look past the marketing claims on the front of the packaging and turn straight to the ingredient list. Ingredients are listed in descending order by weight, so the first few ingredients make up the majority of the food. Pay close attention to serving sizes and look for hidden additives, sugars, or binders that violate your diet rules.', 
 ARRAY['keto', 'carnivore', 'paleo', 'vegan', 'whole30']),

('hidden-sugars-50-names', 'Hidden Sugars and Their 50+ Names', 
 'Sugar is frequently hidden under complex scientific or natural-sounding names on ingredient labels. Common aliases include high-fructose corn syrup, barley malt, dextrose, maltose, agave nectar, cane juice, maltodextrin, rice syrup, and turbinado sugar. When following Keto, Paleo, or Whole30, it is crucial to recognize these terms to prevent accidental sugar consumption and maintain metabolic compliance.', 
 ARRAY['keto', 'paleo', 'whole30']),

('common-food-additives-to-avoid', 'Common Food Additives to Avoid', 
 'Processed foods often contain emulsifiers, thickeners, and preservatives that can disrupt gut health or trigger inflammatory responses. Additives like carrageenan, monosodium glutamate (MSG), sulfites, titanium dioxide, and artificial food colorings are commonly banned on clean-eating protocols like Whole30 and Paleo. Learn to spot these chemical names on packages to keep your food clean.', 
 ARRAY['whole30', 'paleo', 'vegan']),

('understanding-macronutrients', 'Understanding Macronutrients', 
 'Macronutrients — carbohydrates, proteins, and fats — form the foundation of our dietary intake. Different protocols prioritize different ratios of these macros. For instance, Keto requires high fat (70-75%), moderate protein (20%), and very low carbohydrates (5-10%), while Carnivore focuses almost exclusively on protein and fats. Understanding how to calculate and track these macros is essential for achieving your specific health goals.', 
 ARRAY['keto', 'carnivore', 'paleo', 'vegan', 'whole30']),

('meal-prep-basics-keto', 'Meal Prep Basics for Keto', 
 'Successful keto meal prep centers around healthy fats and moderate proteins. Focus on prepping versatile ingredients like roasted cruciferous vegetables, grilled chicken breasts, bacon, boiled eggs, and keeping healthy fats like avocados, olive oil, and butter readily available. Portion your meals into airtight containers to lock in freshness and keep your macros balanced throughout the week.', 
 ARRAY['keto']),

('meal-prep-basics-carnivore', 'Meal Prep Basics for Carnivore', 
 'Carnivore meal prep is straightforward but requires quality sourcing. Pre-portion ground beef patties, steak cuts, and chicken thighs. Slow-cooking larger cuts of beef or roasting pork belly provides delicious, fatty meals that reheat well. Keep butter, tallow, or lard on hand for cooking fat, and ensure you have high-quality sea salt for seasoning.', 
 ARRAY['carnivore']),

('meal-prep-basics-paleo', 'Meal Prep Basics for Paleo', 
 'Paleo meal prep combines lean proteins with abundant fresh vegetables and healthy fats. Spend time pre-chopping vegetables, baking sweet potatoes, and grilling meats. Homemade sauces made from olive oil, garlic, and herbs can add variety and flavor without relying on dairy or refined sugars. Utilize nuts and seeds for quick, portable snacks.', 
 ARRAY['paleo']),

('meal-prep-basics-vegan', 'Meal Prep Basics for Vegan', 
 'Vegan meal prep is highly versatile, focusing on legumes, grains, tofu, and fresh produce. Batch-cook grains like quinoa and brown rice, and prepare proteins like roasted chickpeas, tofu cubes, and lentil stews. Pre-wash and chop leafy greens and raw vegetables. Creating flavorful dressings using tahini, lemon juice, and nutritional yeast will make meal assembly quick and delicious.', 
 ARRAY['vegan']),

('meal-prep-basics-whole30', 'Meal Prep Basics for Whole30', 
 'Whole30 prep requires reading every single label and preparing meals from scratch. Roast large batches of compliant vegetables, bake chicken breasts, and make your own clarified butter (ghee). Prepare homemade compliant sauces like basic mayonnaise and avocado crema to elevate simple dishes. Always have hard-boiled eggs and canned tuna on hand for emergencies.', 
 ARRAY['whole30']),

('eating-out-on-keto', 'Eating Out on Keto', 
 'Navigating restaurant menus on Keto is easier than it looks. Opt for grilled meats or fish accompanied by low-carb vegetables instead of fries or rice. Ask for burgers to be served in lettuce wraps, and request olive oil or vinegar for salad dressings. Be wary of hidden sugars in marinades, sauces, and gravies, and always ask your server about gluten or starch thickeners.', 
 ARRAY['keto']),

('eating-out-on-carnivore', 'Eating Out on Carnivore', 
 'Eating out on Carnivore requires simplicity and clear communication. Look for steak houses or burger joints where you can order plain meat patties or steaks. Explicitly request that your meat be cooked in butter or bacon fat instead of vegetable oils, and ask to omit all seasonings other than salt. Avoid sauces, marinades, and sides entirely.', 
 ARRAY['carnivore']),

('eating-out-on-paleo', 'Eating Out on Paleo', 
 'When dining out Paleo, focus on simple protein and vegetable combinations. Choose dishes that are grilled, baked, or roasted, and ask for them to be prepared without butter, cheese, or soy sauce. Opt for salads with olive oil and lemon juice, or substitute grains/potatoes with extra green vegetables. Politely decline the bread basket as soon as you sit down.', 
 ARRAY['paleo']),

('eating-out-on-vegan', 'Eating Out on Vegan', 
 'Eating out as a vegan has become increasingly accessible. Look for dedicated vegan options or cuisines that naturally highlight plant foods, such as Indian, Thai, Mediterranean, or Mexican. Don''t hesitate to ask for modifications, like swapping cheese for avocado, or replacing meat with beans or tofu. Double-check that broths are vegetable-based and that sauces do not contain fish sauce or dairy.', 
 ARRAY['vegan']),

('supplement-guide-per-protocol', 'Supplement Guide Per Protocol', 
 'Depending on your dietary path, certain supplements can optimize your health. Keto followers often require electrolytes (sodium, potassium, magnesium) to prevent the "keto flu." Vegans should consistently supplement with Vitamin B12, and may benefit from Vitamin D and Omega-3 (algae-based). Carnivores sometimes need temporary digestive enzyme support, while Paleo and Whole30 adherents focus on high-quality fish oil.', 
 ARRAY['keto', 'carnivore', 'paleo', 'vegan', 'whole30']),

('how-dietscan-compliance-scoring-works', 'How DietScan Compliance Scoring Works', 
 'DietScan calculates your compliance score by analyzing the ingredients of scanned items against your selected protocol''s rules. Every scan checks for banned items and categories, factoring in allowed exceptions. Your daily score represents the percentage of compliant meals and ingredients logged. Maintaining a score above 90% is highly recommended for achieving optimal physiological adaptation to your chosen protocol.', 
 ARRAY['keto', 'carnivore', 'paleo', 'vegan', 'whole30']);
