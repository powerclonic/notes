import pool from './db.js';
import type { RowDataPacket } from 'mysql2';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

export async function findByEmail(email: string): Promise<User | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = ?',
    [email.toLowerCase()]
  );
  const row = rows[0];
  if (!row) return undefined;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, createdAt: Number(row.created_at) };
}

export async function findById(id: string): Promise<User | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT id, email, password_hash, created_at FROM users WHERE id = ?',
    [id]
  );
  const row = rows[0];
  if (!row) return undefined;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, createdAt: Number(row.created_at) };
}

export async function createUser(id: string, email: string, passwordHash: string): Promise<User> {
  const createdAt = Date.now();
  await pool.execute(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    [id, email.toLowerCase(), passwordHash, createdAt]
  );
  return { id, email: email.toLowerCase(), passwordHash, createdAt };
}
