import pool from '../db.js';

export async function listUsers() {
    const distributors = await pool.query('SELECT id, name, tier FROM distributors ORDER BY id');
    const managers = await pool.query('SELECT id, name FROM sales_managers ORDER BY id');
    return { distributors: distributors.rows, managers: managers.rows };
}

export async function findUser(role, id) {
    const table = role === 'distributor' ? 'distributors' : 'sales_managers';
    const { rows } = await pool.query(`SELECT id, name FROM ${table} WHERE id = $1`, [id]);
    return rows[0] || null;
}