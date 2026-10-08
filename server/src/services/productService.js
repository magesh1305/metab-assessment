import pool from '../db.js';

export async function listProducts() {
    const { rows } = await pool.query(`
    SELECT id, sku, name, unit_price,
           stock_on_hand - stock_reserved AS available
    FROM products
    ORDER BY sku
  `);
    return rows;
}