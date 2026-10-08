import pool from '../db.js';

const ERP_URL = process.env.ERP_URL;
const POLL_MS = 2000;
const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 6;

async function sendEvent(row) {
    const response = await fetch(ERP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.status;
}

async function processBatch() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT * FROM erp_outbox
       WHERE status = 'PENDING' AND next_attempt_at <= now()
       ORDER BY id
       LIMIT 10
       FOR UPDATE SKIP LOCKED`
        );

        for (const row of rows) {
            let outcome;
            try {
                const status = await sendEvent(row);
                if (status >= 200 && status < 300) outcome = 'sent';
                else if (status >= 500) outcome = 'retry';
                else outcome = 'failed';
            } catch (err) {
                outcome = 'retry';
            }

            const attempts = row.attempts + 1;

            if (outcome === 'sent') {
                await client.query(
                    `UPDATE erp_outbox SET status = 'SENT', attempts = $2 WHERE id = $1`,
                    [row.id, attempts]
                );
            } else if (outcome === 'retry' && attempts < MAX_ATTEMPTS) {
                const delaySeconds = 2 ** attempts;
                await client.query(
                    `UPDATE erp_outbox
           SET attempts = $2, next_attempt_at = now() + ($3 * interval '1 second')
           WHERE id = $1`,
                    [row.id, attempts, delaySeconds]
                );
            } else {
                await client.query(
                    `UPDATE erp_outbox SET status = 'FAILED', attempts = $2 WHERE id = $1`,
                    [row.id, attempts]
                );
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

export function startErpWorker() {
    const tick = async () => {
        try {
            await processBatch();
        } catch (err) {
            console.error('ERP worker error:', err.message);
        } finally {
            setTimeout(tick, POLL_MS);
        }
    };
    tick();
}