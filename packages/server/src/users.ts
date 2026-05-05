import fs from 'node:fs';
import path from 'node:path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

const DB_PATH = process.env.USERS_DB_PATH ?? path.join(process.cwd(), 'data', 'users.json');

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readAll(): User[] {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as User[];
  } catch {
    return [];
  }
}

function writeAll(users: User[]): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export function findByEmail(email: string): User | undefined {
  return readAll().find((u) => u.email === email.toLowerCase());
}

export function findById(id: string): User | undefined {
  return readAll().find((u) => u.id === id);
}

export function createUser(id: string, email: string, passwordHash: string): User {
  const users = readAll();
  const user: User = { id, email: email.toLowerCase(), passwordHash, createdAt: Date.now() };
  users.push(user);
  writeAll(users);
  return user;
}
