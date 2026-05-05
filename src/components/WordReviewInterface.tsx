import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UncertainWord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Check, Warning } from '@phosphor-icons/react';

interface WordReviewInterfaceProps {
  text: string;
  uncertainWords: UncertainWord[];
  onComplete: (correctedText: string) => void;
}

export function WordReviewInterface({
  text,
  uncertainWords,
  onComplete,
}: WordReviewInterfaceProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [editingWord, setEditingWord] = useState<UncertainWord | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');

  const openEditDialog = (word: UncertainWord) => {
    setEditingWord(word);
    setCorrectionInput(corrections.get(word.startIndex) || word.word);
  };

  const saveCorrection = () => {
    if (editingWord) {
      const newCorrections = new Map(corrections);
      newCorrections.set(editingWord.startIndex, correctionInput);
      setCorrections(newCorrections);
      setEditingWord(null);

      if (currentWordIndex < uncertainWords.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
      }
    }
  };

  const skipWord = () => {
    if (currentWordIndex < uncertainWords.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
    }
  };

  const completeReview = () => {
    let correctedText = text;
    const sortedWords = [...uncertainWords].sort((a, b) => b.startIndex - a.startIndex);

    for (const word of sortedWords) {
      const correction = corrections.get(word.startIndex);
      if (correction && correction !== word.word) {
        correctedText =
          correctedText.slice(0, word.startIndex) +
          correction +
          correctedText.slice(word.endIndex);
      }
    }

    onComplete(correctedText);
  };

  const renderTextWithHighlights = () => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    const sortedWords = [...uncertainWords].sort((a, b) => a.startIndex - b.startIndex);

    sortedWords.forEach((word, idx) => {
      if (lastIndex < word.startIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>{text.slice(lastIndex, word.startIndex)}</span>
        );
      }

      const isReviewed = corrections.has(word.startIndex);
      const isCurrent = idx === currentWordIndex;

      parts.push(
        <span
          key={`word-${word.startIndex}`}
          className={`uncertain-word ${isCurrent ? 'ring-2 ring-accent' : ''} ${
            isReviewed ? 'bg-green-100 border-green-500' : ''
          }`}
          onClick={() => openEditDialog(word)}
        >
          {corrections.get(word.startIndex) || word.word}
          {isReviewed && <Check className="inline w-3 h-3 ml-1 text-green-600" weight="bold" />}
        </span>
      );

      lastIndex = word.endIndex;
    });

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  const reviewedCount = corrections.size;
  const totalWords = uncertainWords.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Revisão de Palavras</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique nas palavras destacadas para corrigi-las
          </p>
        </div>
        <Badge variant="secondary" className="px-4 py-2">
          {reviewedCount}/{totalWords} revisadas
        </Badge>
      </div>

      <div className="flex-1 overflow-auto bg-card rounded-lg p-6 border border-border mb-6">
        <div className="text-base leading-relaxed whitespace-pre-wrap font-body">
          {renderTextWithHighlights()}
        </div>
      </div>

      <div className="flex gap-3">
        {currentWordIndex < totalWords - 1 && (
          <Button onClick={skipWord} variant="outline" className="flex-1">
            Pular Palavra
          </Button>
        )}
        <Button onClick={completeReview} className="flex-1 bg-accent hover:bg-accent/90">
          <Check className="w-5 h-5 mr-2" weight="bold" />
          {reviewedCount === totalWords ? 'Concluir' : 'Concluir Mesmo Assim'}
        </Button>
      </div>

      <Dialog open={editingWord !== null} onOpenChange={() => setEditingWord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning className="w-5 h-5 text-accent" weight="fill" />
              Corrigir Palavra
            </DialogTitle>
            <DialogDescription>
              A IA não conseguiu identificar esta palavra com certeza. Por favor, corrija se
              necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="correction-input">Palavra detectada</Label>
              <Input
                id="correction-input"
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveCorrection();
                  }
                }}
                autoFocus
              />
            </div>

            {editingWord?.suggestions && editingWord.suggestions.length > 0 && (
              <div className="space-y-2">
                <Label>Sugestões</Label>
                <div className="flex flex-wrap gap-2">
                  {editingWord.suggestions.map((suggestion, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => setCorrectionInput(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWord(null)}>
              Cancelar
            </Button>
            <Button onClick={saveCorrection} className="bg-accent hover:bg-accent/90">
              Salvar Correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
