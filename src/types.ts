export interface UncertainWord {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions?: string[];
}

export interface ProcessedNote {
  id: string;
  originalImage: string;
  extractedText: string;
  uncertainWords: UncertainWord[];
  correctedText?: string;
  structuredContent?: string;
  status: 'processing' | 'review' | 'completed';
  createdAt: number;
  title?: string;
}

export type NoteType = 'mapa-mental' | 'insights-corporativos' | 'anotacoes' | 'ideias';

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  'mapa-mental': 'Mapa Mental',
  'insights-corporativos': 'Insights Corporativos',
  'anotacoes': 'Anotações',
  'ideias': 'Ideias',
};

export const NOTE_TYPE_ICONS: Record<NoteType, string> = {
  'mapa-mental': '🗺️',
  'insights-corporativos': '💼',
  'anotacoes': '📝',
  'ideias': '💡',
};

export interface Note {
  id: string;
  title: string;
  content: string;
  noteType?: NoteType;
  originalImage?: string;
  createdAt: number;
  updatedAt: number;
}
