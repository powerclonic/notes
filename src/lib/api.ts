export interface ImageBboxApi {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface UncertainWordApi {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions?: string[];
  imageBbox?: ImageBboxApi;
}

export interface OcrResult {
  fullText: string;
  uncertainWords: UncertainWordApi[];
  imageType?: string;
}

export interface StructureResult {
  title: string;
  content: string;
}

export interface NoteConfigApi {
  detailLevel?: string;
  tone?: string;
  includeExamples?: boolean;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((payload as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((payload as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok && res.status !== 204) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((payload as { error?: string }).error ?? res.statusText);
  }
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((payload as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Extract text from a base64 data-URL image using the backend OCR endpoint. */
export function processImageOcr(imageData: string, theme?: string): Promise<OcrResult> {
  return post<OcrResult>('/api/ocr', { imageData, theme });
}

/** Structure raw text into a titled, formatted note via the backend. */
export function structureNote(
  text: string,
  noteType?: string,
  existingNote?: { title: string; content: string },
  config?: NoteConfigApi,
  theme?: string
): Promise<StructureResult> {
  return post<StructureResult>('/api/structure', { text, noteType, existingNote, config, theme });
}

/** Generate a new note inspired by existing notes and a user prompt. */
export function generateNoteFromNotes(
  notes: Array<{ title: string; content: string }>,
  prompt: string,
  noteType?: string,
  config?: NoteConfigApi
): Promise<StructureResult> {
  return post<StructureResult>('/api/generate', { notes, prompt, noteType, config });
}

/** Generate slide-structured markdown from a prompt and context. */
export function generateSlides(
  prompt: string,
  context: string,
  config?: NoteConfigApi,
  notesContext?: string
): Promise<StructureResult> {
  return post<StructureResult>('/api/slides', { prompt, context, config, notesContext });
}

/** Register a new user. */
export function register(email: string, password: string): Promise<AuthResult> {
  return post<AuthResult>('/api/auth/register', { email, password });
}

/** Log in with email and password. */
export function login(email: string, password: string): Promise<AuthResult> {
  return post<AuthResult>('/api/auth/login', { email, password });
}

/** Get current authenticated user info. */
export function getMe(): Promise<{ id: string; email: string }> {
  return get<{ id: string; email: string }>('/api/auth/me');
}

// ---------------------------------------------------------------------------
// Notes CRUD
// ---------------------------------------------------------------------------

export interface NoteApi {
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

/** Fetch all notes for the authenticated user. */
export function getNotes(): Promise<NoteApi[]> {
  return get<NoteApi[]>('/api/notes');
}

/** Persist a new note to the backend. */
export function saveNote(note: Omit<NoteApi, 'userId'>): Promise<NoteApi> {
  return post<NoteApi>('/api/notes', note);
}

/** Update an existing note on the backend. */
export function patchNote(
  id: string,
  fields: Partial<Pick<NoteApi, 'title' | 'content' | 'noteType' | 'originalImage' | 'originalImages'>>
): Promise<NoteApi> {
  return put<NoteApi>(`/api/notes/${id}`, fields);
}

/** Delete a note from the backend. */
export function removeNote(id: string): Promise<void> {
  return del(`/api/notes/${id}`);
}
