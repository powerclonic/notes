export interface ImageBbox {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface UncertainWord {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions?: string[];
  imageBbox?: ImageBbox;
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

export type NoteType = 'mapa-mental' | 'insights-corporativos' | 'anotacoes' | 'ideias' | 'slides';

export type DetailLevel = 'resumido' | 'normal' | 'detalhado';
export type WritingTone = 'formal' | 'neutro' | 'casual';

export interface NoteConfig {
  detailLevel: DetailLevel;
  tone: WritingTone;
  includeExamples: boolean;
}

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  'mapa-mental': 'Mapa Mental',
  'insights-corporativos': 'Insights Corporativos',
  'anotacoes': 'Anotações',
  'ideias': 'Ideias',
  'slides': 'Slides',
};

export const NOTE_TYPE_ICONS: Record<NoteType, string> = {
  'mapa-mental': '🗺️',
  'insights-corporativos': '💼',
  'anotacoes': '📝',
  'ideias': '💡',
  'slides': '🎞️',
};

export const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  resumido: 'Resumido',
  normal: 'Normal',
  detalhado: 'Detalhado',
};

export const WRITING_TONE_LABELS: Record<WritingTone, string> = {
  formal: 'Formal',
  neutro: 'Neutro',
  casual: 'Casual',
};

export const DEFAULT_NOTE_CONFIG: NoteConfig = {
  detailLevel: 'normal',
  tone: 'neutro',
  includeExamples: false,
};

export interface Note {
  id: string;
  title: string;
  content: string;
  noteType?: NoteType;
  originalImage?: string;
  originalImages?: string[];
  createdAt: number;
  updatedAt: number;
}
