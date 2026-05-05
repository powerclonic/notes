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

export interface Note {
  id: string;
  title: string;
  content: string;
  originalImage?: string;
  createdAt: number;
  updatedAt: number;
}
