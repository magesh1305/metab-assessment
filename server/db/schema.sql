DROP TABLE IF EXISTS erp_outbox, order_events, points_ledger, order_items,
                     orders, products, distributors, sales_managers CASCADE;

CREATE TABLE products (
  id             SERIAL PRIMARY KEY,
  sku            VARCHAR(32)   NOT NULL UNIQUE,
  name           VARCHAR(200)  NOT NULL,
  unit_price     NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  stock_on_hand  INTEGER NOT NULL CHECK (stock_on_hand >= 0),
  stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  CHECK (stock_reserved <= stock_on_hand)
);

CREATE TABLE distributors (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200)  NOT NULL,
  credit_limit NUMERIC(12,2) NOT NULL CHECK (credit_limit >= 0),
  tier         VARCHAR(10)   NOT NULL CHECK (tier IN ('Bronze','Silver','Gold'))
);

CREATE TABLE sales_managers (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL
);

CREATE TABLE orders (
  id              SERIAL PRIMARY KEY,
  distributor_id  INTEGER NOT NULL REFERENCES distributors(id),
  status          VARCHAR(20) NOT NULL CHECK (status IN
                  ('Placed','PendingApproval','Confirmed','Dispatched','Delivered','Cancelled','Rejected')),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_pct    NUMERIC(5,2)  NOT NULL CHECK (discount_pct >= 0),
  discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  idempotency_key VARCHAR(100) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  UNIQUE (order_id, product_id)
);

CREATE TABLE order_events (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  actor_type  VARCHAR(20) NOT NULL CHECK (actor_type IN ('distributor','manager','system')),
  actor_id    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE points_ledger (
  id             SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id),
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  entry_type     VARCHAR(10) NOT NULL CHECK (entry_type IN ('AWARD','REVERSAL')),
  points         INTEGER NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (order_id, entry_type)
);

CREATE TABLE erp_outbox (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  payload         JSONB NOT NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);