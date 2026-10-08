import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import currentUser from './middleware/currentUser.js';
import usersRouter from './routes/users.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import meRouter from './routes/me.js';
import { startErpWorker } from './services/erpWorker.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', usersRouter);

app.use('/api', currentUser);
app.use('/api/me', meRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error', details: err.details });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`API running on:${port}`);
    startErpWorker();
});
