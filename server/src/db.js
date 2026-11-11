import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
      CREATE TABLE IF NOT EXISTS sermons (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Sem título',
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS sermons_user_updated_idx ON sermons (user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS study_notes (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, key)
      );
    `);
    console.log('Conectado ao PostgreSQL com sucesso.');
  } finally {
    client.release();
  }
}