import fs from 'node:fs/promises';
import pool from '../src/db.js';

const schema = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const seed = await fs.readFile(new URL('./seed.sql', import.meta.url), 'utf8');

await pool.query(schema);
await pool.query(seed);

console.log('Database reset and seeded.');
await pool.end();