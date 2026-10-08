import pool from '../db.js';
import { pointsLast90Days, tierFor } from './loyaltyService.js';
import { outstandingTotal } from './orderService.js';
import { toCents, fromCents } from '../utils/money.js';

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

export async function getDistributorSummary(id) {
    const { rows } = await pool.query(
        'SELECT id, name, credit_limit FROM distributors WHERE id = $1',
        [id]
    );
    const distributor = rows[0];
    const points = await pointsLast90Days(pool, id);
    const outstanding = await outstandingTotal(pool, id);

    return {
        ...distributor,
        points,
        tier: tierFor(points),
        available_credit: fromCents(toCents(distributor.credit_limit) - toCents(outstanding)),
    };
}