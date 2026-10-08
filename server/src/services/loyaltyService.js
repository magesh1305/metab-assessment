import { toCents } from '../utils/money.js';

export const TIER_DISCOUNT = { Bronze: 0, Silver: 3, Gold: 6 };

export function tierFor(points) {
    if (points >= 5000) return 'Gold';
    if (points >= 1000) return 'Silver';
    return 'Bronze';
}

export async function pointsLast90Days(db, distributorId) {
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(points), 0)::int AS points
     FROM points_ledger
     WHERE distributor_id = $1
       AND earned_at >= now() - interval '90 days'`,
        [distributorId]
    );
    return rows[0].points;
}

export async function recalculateTier(client, distributorId) {
    const points = await pointsLast90Days(client, distributorId);
    const tier = tierFor(points);
    await client.query('UPDATE distributors SET tier = $2 WHERE id = $1', [distributorId, tier]);
    return tier;
}

export async function awardPoints(client, order) {
    const points = Math.floor(toCents(order.total) / 10000);
    await client.query(
        `INSERT INTO points_ledger (distributor_id, order_id, entry_type, points, earned_at)
     VALUES ($1, $2, 'AWARD', $3, now())`,
        [order.distributor_id, order.id, points]
    );
    return recalculateTier(client, order.distributor_id);
}