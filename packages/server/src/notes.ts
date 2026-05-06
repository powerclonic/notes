import pool from './db.js';
import type { RowDataPacket } from 'mysql2';

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  noteType?: string;
  originalImage?: string;
  originalImages?: string[];
  createdAt: number;
  updatedAt: number;
}

interface NoteRow extends RowDataPacket {
  id: string;
  user_id: string;
  title: string;
  content: string;
  note_type: string | null;
  original_image: string | null;
  original_images: string | null;
  created_at: number;
  updated_at: number;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    noteType: row.note_type ?? undefined,
    originalImage: row.original_image ?? undefined,
    originalImages: row.original_images ? (JSON.parse(row.original_images) as string[]) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getNotesByUser(userId: string): Promise<Note[]> {
  const [rows] = await pool.execute<NoteRow[]>(
    'SELECT id, user_id, title, content, note_type, original_image, original_images, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map(rowToNote);
}

export async function createNote(note: Omit<Note, 'userId'> & { userId: string }): Promise<Note> {
  await pool.execute(
    'INSERT INTO notes (id, user_id, title, content, note_type, original_image, original_images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      note.id,
      note.userId,
      note.title,
      note.content,
      note.noteType ?? null,
      note.originalImage ?? null,
      note.originalImages ? JSON.stringify(note.originalImages) : null,
      note.createdAt,
      note.updatedAt,
    ]
  );
  return note;
}

export async function updateNote(
  id: string,
  userId: string,
  fields: Partial<Pick<Note, 'title' | 'content' | 'noteType' | 'originalImage' | 'originalImages'>>
): Promise<Note | undefined> {
  const updatedAt = Date.now();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [updatedAt];

  if (fields.title !== undefined) { setClauses.push('title = ?'); values.push(fields.title); }
  if (fields.content !== undefined) { setClauses.push('content = ?'); values.push(fields.content); }
  if ('noteType' in fields) { setClauses.push('note_type = ?'); values.push(fields.noteType ?? null); }
  if ('originalImage' in fields) { setClauses.push('original_image = ?'); values.push(fields.originalImage ?? null); }
  if ('originalImages' in fields) {
    setClauses.push('original_images = ?');
    values.push(fields.originalImages ? JSON.stringify(fields.originalImages) : null);
  }

  values.push(id, userId);

  await pool.execute(
    `UPDATE notes SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
  const [rows] = await pool.execute<NoteRow[]>(
    'SELECT id, user_id, title, content, note_type, original_image, original_images, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] ? rowToNote(rows[0]) : undefined;
}

export async function deleteNote(id: string, userId: string): Promise<boolean> {
  const [result] = await pool.execute<import('mysql2').ResultSetHeader>(
    'DELETE FROM notes WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows > 0;
}
