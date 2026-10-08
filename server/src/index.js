import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import currentUser from './middleware/currentUser.js';
import usersRouter from './routes/users.js';
import productsRouter from './routes/products.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', usersRouter);

app.use('/api', currentUser);
app.use('/api/products', productsRouter);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on:${port}`));

