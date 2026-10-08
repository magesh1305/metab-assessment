import pg from 'pg';
import 'dotenv/config';

pg.types.setTypeParser(1700, (value) => parseFloat(value));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;