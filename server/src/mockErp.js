import express from 'express';

const app = express();
app.use(express.json());

const FAIL_RATE = Number(process.env.ERP_FAIL_RATE || 0);
const DELAY_MS = Number(process.env.ERP_DELAY_MS || 0);

app.post('/erp/events', (req, res) => {
    const event = req.body;

    setTimeout(() => {
        if (Math.random() < FAIL_RATE) {
            console.log(`ERP: returning 500 for order ${event.orderId} -> ${event.toStatus}`);
            return res.status(500).json({ error: 'Simulated ERP failure' });
        }
        console.log(`ERP: received order ${event.orderId} ${event.fromStatus} -> ${event.toStatus}`);
        res.json({ received: true });
    }, DELAY_MS);
});

app.listen(4001, () => console.log('Mock ERP running on http://localhost:4001'));