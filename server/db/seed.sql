INSERT INTO products (sku, name, unit_price, stock_on_hand) VALUES
  ('SKU-1001', 'Filter Coffee Powder 500g x 20', 1250.00, 480),
  ('SKU-1002', 'Gingelly Oil 1L x 12',           2380.00, 215),
  ('SKU-1003', 'Sambar Powder 200g x 40',        1760.00, 340),
  ('SKU-1004', 'Ponni Rice 5kg x 5',             3150.00, 120),
  ('SKU-1005', 'Coconut Oil 200ml x 24',          720.00, 600),
  ('SKU-1006', 'Neem Soap 100g x 48',             940.00,   1),
  ('SKU-1007', 'Ghee 1L x 12',                   4520.00,   0),
  ('SKU-1008', 'Detergent Powder 1kg x 12',      1090.00, 275);

INSERT INTO distributors (name, credit_limit, tier) VALUES
  ('Sri Murugan Agencies',  5000.00,   'Bronze'),
  ('Lakshmi Traders',       20000.00,  'Silver'),
  ('Annai Distributors',    100000.00, 'Gold');

INSERT INTO sales_managers (name) VALUES ('Deepika');

INSERT INTO orders (distributor_id, status, subtotal, discount_pct, discount_amount, total, created_at) VALUES
  (2, 'Delivered', 490000, 0, 0, 490000, now() - interval '32 days'),
  (3, 'Delivered', 567000, 0, 0, 567000, now() - interval '18 days');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 392, 1250), 
  (2, 4, 180, 3150);

INSERT INTO points_ledger (distributor_id, order_id, entry_type, points, earned_at) VALUES
  (2, 1, 'AWARD', 4900, now() - interval '32 days'),
  (3, 2, 'AWARD', 5670, now() - interval '18 days');