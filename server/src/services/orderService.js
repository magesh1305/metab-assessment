import pool from '../db.js';
import { httpError } from '../utils/httpError.js';
import { toCents, fromCents } from '../utils/money.js';
import { TIER_DISCOUNT, recalculateTier, awardPoints, reversePoints } from './loyaltyService.js';

const ROLE_FOR_STATUS = {
    Confirmed: 'manager',
    Rejected: 'manager',
    Dispatched: 'manager',
    Delivered: 'manager',
    Cancelled: 'distributor',
};

export const TRANSITIONS = {
    Placed: ['Confirmed', 'PendingApproval', 'Cancelled'],
    PendingApproval: ['Confirmed', 'Rejected', 'Cancelled'],
    Confirmed: ['Dispatched', 'Cancelled'],
    Dispatched: ['Delivered'],
    Delivered: [],
    Cancelled: [],
    Rejected: [],
};

export async function outstandingTotal(db, distributorId) {
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(total), 0) AS outstanding
     FROM orders
     WHERE distributor_id = $1
       AND status NOT IN ('Delivered', 'Cancelled', 'Rejected')`,
        [distributorId]
    );
    return rows[0].outstanding;
}

export async function logStatusChange(client, order, fromStatus, toStatus, actor) {
    await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor_type, actor_id)
     VALUES ($1, $2, $3, $4, $5)`,
        [order.id, fromStatus, toStatus, actor.type, actor.id]
    );

    const payload = {
        event: 'order.status_changed',
        orderId: order.id,
        distributorId: order.distributor_id,
        fromStatus,
        toStatus,
        total: order.total,
        actor,
        occurredAt: new Date().toISOString(),
    };
    await client.query('INSERT INTO erp_outbox (order_id, payload) VALUES ($1, $2)', [order.id, payload]);
}

export async function changeStatus(client, order, toStatus, actor) {
    if (!TRANSITIONS[order.status].includes(toStatus)) {
        throw httpError(409, `Cannot change order from ${order.status} to ${toStatus}`);
    }
    const fromStatus = order.status;
    await client.query('UPDATE orders SET status = $2 WHERE id = $1', [order.id, toStatus]);
    order.status = toStatus;
    await logStatusChange(client, order, fromStatus, toStatus, actor);
}

function normaliseItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw httpError(400, 'Order needs at least one line item');
    }
    const merged = new Map();
    for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
            throw httpError(400, 'Each item needs a productId and a whole quantity above 0');
        }
        merged.set(productId, (merged.get(productId) || 0) + quantity);
    }
    return [...merged]
        .map(([productId, quantity]) => ({ productId, quantity }))
        .sort((a, b) => a.productId - b.productId);
}

async function findOrderIdByKey(key) {
    const { rows } = await pool.query('SELECT id FROM orders WHERE idempotency_key = $1', [key]);
    return rows[0]?.id || null;
}

export async function placeOrder(distributorId, items, idempotencyKey) {
    const lines = normaliseItems(items);

    if (idempotencyKey) {
        const existingId = await findOrderIdByKey(idempotencyKey);
        if (existingId) return { orderId: existingId, created: false };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [distributor] } = await client.query(
            'SELECT credit_limit FROM distributors WHERE id = $1 FOR UPDATE',
            [distributorId]
        );

        let subtotalCents = 0;
        const priced = [];
        for (const line of lines) {
            const { rows } = await client.query(
                `UPDATE products
         SET stock_reserved = stock_reserved + $2
         WHERE id = $1 AND stock_on_hand - stock_reserved >= $2
         RETURNING unit_price`,
                [line.productId, line.quantity]
            );

            if (rows.length === 0) {
                const { rows: found } = await client.query(
                    'SELECT sku, stock_on_hand - stock_reserved AS available FROM products WHERE id = $1',
                    [line.productId]
                );
                if (found.length === 0) throw httpError(400, `Product ${line.productId} does not exist`);
                const { sku, available } = found[0];
                throw httpError(
                    409,
                    `Not enough stock for ${sku}: requested ${line.quantity}, available ${available}`,
                    { sku, available }
                );
            }

            const unitPrice = rows[0].unit_price;
            subtotalCents += toCents(unitPrice) * line.quantity;
            priced.push({ ...line, unitPrice });
        }

        const tier = await recalculateTier(client, distributorId);
        const discountPct = TIER_DISCOUNT[tier];
        const discountCents = Math.round((subtotalCents * discountPct) / 100);
        const totalCents = subtotalCents - discountCents;

        const outstanding = await outstandingTotal(client, distributorId);
        const availableCreditCents = toCents(distributor.credit_limit) - toCents(outstanding);

        const { rows: [order] } = await client.query(
            `INSERT INTO orders (distributor_id, status, subtotal, discount_pct, discount_amount, total, idempotency_key)
       VALUES ($1, 'Placed', $2, $3, $4, $5, $6)
       RETURNING *`,
            [distributorId, fromCents(subtotalCents), discountPct, fromCents(discountCents),
                fromCents(totalCents), idempotencyKey || null]
        );

        for (const line of priced) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
                [order.id, line.productId, line.quantity, line.unitPrice]
            );
        }

        await logStatusChange(client, order, null, 'Placed', { type: 'distributor', id: distributorId });

        const system = { type: 'system', id: null };
        if (totalCents > availableCreditCents) {
            await changeStatus(client, order, 'PendingApproval', system);
        } else {
            await changeStatus(client, order, 'Confirmed', system);
            await awardPoints(client, order);
        }

        await client.query('COMMIT');
        return { orderId: order.id, created: true };
    } catch (err) {
        await client.query('ROLLBACK');

        if (err.code === '23505' && err.constraint === 'orders_idempotency_key_key') {
            const existingId = await findOrderIdByKey(idempotencyKey);
            return { orderId: existingId, created: false };
        }
        throw err;
    } finally {
        client.release();
    }
}

export async function listOrders(user, status) {
    console.log({ user, status })
    const params = [];
    const conditions = [];

    if (user.role === 'distributor') {
        params.push(user.id);
        conditions.push(`o.distributor_id = $${params.length}`);
    }
    if (status) {
        params.push(status);
        conditions.push(`o.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
        `SELECT o.*, d.name AS distributor_name
     FROM orders o
     JOIN distributors d ON d.id = o.distributor_id
     ${where}
     ORDER BY o.id DESC`,
        params
    );
    return rows;
}

export async function getOrder(user, orderId) {
    const { rows } = await pool.query(
        `SELECT o.*, d.name AS distributor_name
     FROM orders o
     JOIN distributors d ON d.id = o.distributor_id
     WHERE o.id = $1`,
        [orderId]
    );
    const order = rows[0];
    if (!order || (user.role === 'distributor' && order.distributor_id !== user.id)) {
        throw httpError(404, 'Order not found');
    }

    const items = await pool.query(
        `SELECT oi.product_id, p.sku, p.name, oi.quantity, oi.unit_price,
            oi.quantity * oi.unit_price AS line_total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY p.sku`,
        [orderId]
    );

    const events = await pool.query(
        `SELECT from_status, to_status, actor_type, actor_id, created_at
     FROM order_events
     WHERE order_id = $1
     ORDER BY id`,
        [orderId]
    );

    return { ...order, items: items.rows, events: events.rows };
}

async function releaseStock(client, orderId) {
    await client.query(
        `UPDATE products p
     SET stock_reserved = p.stock_reserved - oi.quantity
     FROM order_items oi
     WHERE oi.product_id = p.id AND oi.order_id = $1`,
        [orderId]
    );
}

async function deductStock(client, orderId) {
    await client.query(
        `UPDATE products p
     SET stock_on_hand  = p.stock_on_hand  - oi.quantity,
         stock_reserved = p.stock_reserved - oi.quantity
     FROM order_items oi
     WHERE oi.product_id = p.id AND oi.order_id = $1`,
        [orderId]
    );
}

export async function transitionOrder(user, orderId, toStatus) {
    const allowedRole = ROLE_FOR_STATUS[toStatus];
    if (!allowedRole) {
        throw httpError(400, `Status ${toStatus} cannot be set manually`);
    }
    if (user.role !== allowedRole) {
        throw httpError(403, `Only a ${allowedRole} can move an order to ${toStatus}`);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        const order = rows[0];
        if (!order || (user.role === 'distributor' && order.distributor_id !== user.id)) {
            throw httpError(404, 'Order not found');
        }

        const fromStatus = order.status;
        await changeStatus(client, order, toStatus, { type: user.role, id: user.id });

        if (toStatus === 'Confirmed') {
            await awardPoints(client, order);
        }
        if (toStatus === 'Dispatched') {
            await deductStock(client, order.id);
        }
        if (toStatus === 'Cancelled' || toStatus === 'Rejected') {
            await releaseStock(client, order.id);
            if (fromStatus === 'Confirmed') {
                await reversePoints(client, order);
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}