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

/** Extract text from a base64 data-URL image using the backend OCR endpoint. */
export function processImageOcr(imageData: string): Promise<OcrResult> {
  return post<OcrResult>('/api/ocr', { imageData });
}

/** Structure raw text into a titled, formatted note via the backend. */
export function structureNote(
  text: string,
  noteType?: string,
  existingNote?: { title: string; content: string },
  config?: NoteConfigApi
): Promise<StructureResult> {
  return post<StructureResult>('/api/structure', { text, noteType, existingNote, config });
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
