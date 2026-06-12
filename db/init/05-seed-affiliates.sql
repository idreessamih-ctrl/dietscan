\c dietscan_core;

INSERT INTO affiliate_retailers (id, name, network, base_url, commission_rate) VALUES
('11111111-1111-1111-1111-111111111111', 'iHerb', 'Partnerize', 'https://www.iherb.com', 6.50),
('22222222-2222-2222-2222-222222222222', 'Thrive Market', 'CJ Affiliate', 'https://thrivemarket.com', 5.00),
('33333333-3333-3333-3333-333333333333', 'Vitacost', 'CJ Affiliate', 'https://www.vitacost.com', 5.00),
('44444444-4444-4444-4444-444444444444', 'Bodybuilding.com', 'Impact', 'https://www.bodybuilding.com', 6.50),
('55555555-5555-5555-5555-555555555555', 'Swanson', 'FlexOffers', 'https://www.swansonvitamins.com', 5.00),
('66666666-6666-6666-6666-666666666666', 'PureFormulas', 'FlexOffers', 'https://www.pureformulas.com', 5.00),
('77777777-7777-7777-7777-777777777777', 'Life Extension', 'CJ Affiliate', 'https://www.lifeextension.com', 6.50),
('88888888-8888-8888-8888-888888888888', 'Garden of Life', 'Awin', 'https://www.gardenoflife.com', 5.00),
('99999999-9999-9999-9999-999999999999', 'Netrition', 'ShareASale', 'https://www.netrition.com', 6.50),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'The Vitamin Shoppe', 'CJ Affiliate', 'https://www.vitaminshoppe.com', 4.00),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lucky Vitamin', 'ShareASale', 'https://www.luckyvitamin.com', 5.00)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  network = EXCLUDED.network,
  base_url = EXCLUDED.base_url,
  commission_rate = EXCLUDED.commission_rate;
