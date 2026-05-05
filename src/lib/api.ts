export interface UncertainWordApi {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions?: string[];
}

export interface OcrResult {
  fullText: string;
  uncertainWords: UncertainWordApi[];
}

export interface StructureResult {
  title: string;
  content: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  existingNote?: { title: string; content: string }
): Promise<StructureResult> {
  return post<StructureResult>('/api/structure', { text, noteType, existingNote });
}
