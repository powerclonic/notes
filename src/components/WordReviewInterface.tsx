import { useState, useEffect, type ReactElement } from 'react';
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
import { UncertainWord, ImageBbox } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Check, Warning, Image, CaretDown, CaretUp } from '@phosphor-icons/react';

interface WordReviewInterfaceProps {
  text: string;
  uncertainWords: UncertainWord[];
  imageData: string | null;
  onComplete: (correctedText: string) => void;
}

/**
 * Crop a region around the bbox (with padding for context) and draw an orange
 * highlight rectangle around the exact word so the user can see it in context.
 */
function annotateImageRegion(
  imageData: string,
  bbox: ImageBbox,
  callback: (cropped: string | null) => void
) {
  const img = new window.Image();
  img.onload = () => {
    const padding = 10; // 10% padding in each direction for context
    const rx = Math.max(0, bbox.xPercent - padding);
    const ry = Math.max(0, bbox.yPercent - padding);
    const rr = Math.min(100, bbox.xPercent + bbox.widthPercent + padding);
    const rb = Math.min(100, bbox.yPercent + bbox.heightPercent + padding);
    const rw = rr - rx;
    const rh = rb - ry;

    const cx = (rx / 100) * img.width;
    const cy = (ry / 100) * img.height;
    const cw = (rw / 100) * img.width;
    const ch = (rh / 100) * img.height;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(cw, 1);
    canvas.height = Math.max(ch, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      callback(null);
      return;
    }
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

    // Draw orange highlight rectangle around the uncertain word within the crop
    const wordX = ((bbox.xPercent - rx) / rw) * cw;
    const wordY = ((bbox.yPercent - ry) / rh) * ch;
    const wordW = (bbox.widthPercent / rw) * cw;
    const wordH = (bbox.heightPercent / rh) * ch;

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = Math.max(2, cw * 0.004);
    ctx.strokeRect(wordX - 2, wordY - 2, wordW + 4, wordH + 4);

    callback(canvas.toDataURL('image/png'));
  };
  img.onerror = () => callback(null);
  img.src = imageData;
}

export function WordReviewInterface({
  text,
  uncertainWords,
  imageData,
  onComplete,
}: WordReviewInterfaceProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [editingWord, setEditingWord] = useState<UncertainWord | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(true);

  // Compute the annotated context image whenever the editing word changes
  useEffect(() => {
    setAnnotatedImageUrl(null);
    if (!editingWord?.imageBbox || !imageData) return;

    annotateImageRegion(imageData, editingWord.imageBbox, (annotated) => {
      setAnnotatedImageUrl(annotated);
    });
  }, [editingWord, imageData]);

  const openEditDialog = (word: UncertainWord) => {
    const idx = uncertainWords.findIndex((w) => w.startIndex === word.startIndex);
    if (idx !== -1) setCurrentWordIndex(idx);
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
    setEditingWord(null);
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
    const parts: ReactElement[] = [];
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
      <div className="flex items-center justify-between mb-4">
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

      {/* Original image panel with bbox overlays */}
      {imageData && (
        <div className="mb-4 rounded-lg border border-border overflow-hidden bg-muted/20">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
            onClick={() => setShowImagePanel((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <Image className="w-4 h-4" weight="duotone" />
              Imagem original
            </span>
            {showImagePanel ? (
              <CaretUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <CaretDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showImagePanel && (
            <div className="relative max-h-52 overflow-hidden">
              <img
                src={imageData}
                alt="Imagem original"
                className="w-full object-contain"
              />
              {uncertainWords.map((word, idx) => {
                if (!word.imageBbox) return null;
                const { xPercent, yPercent, widthPercent, heightPercent } = word.imageBbox;
                const isCurrent = idx === currentWordIndex;
                const isReviewed = corrections.has(word.startIndex);
                return (
                  <div
                    key={`bbox-${word.startIndex}`}
                    className={`absolute cursor-pointer border-2 transition-all ${
                      isReviewed
                        ? 'border-green-500 bg-green-500/10'
                        : isCurrent
                        ? 'border-orange-500 bg-orange-500/20'
                        : 'border-orange-400/70 bg-orange-400/10 hover:border-orange-500 hover:bg-orange-500/20'
                    }`}
                    style={{
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                    }}
                    onClick={() => openEditDialog(word)}
                    title={word.word}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-card rounded-lg p-6 border border-border mb-4">
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
              A IA não conseguiu identificar esta palavra com certeza. Veja o trecho da imagem
              abaixo (palavra destacada em laranja) e corrija se necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Annotated image region showing word in context with highlight */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Image className="w-4 h-4" weight="duotone" />
                Palavra na imagem
              </Label>
              <div className="rounded-lg border border-border overflow-hidden bg-muted/40 flex items-center justify-center min-h-[80px]">
                {annotatedImageUrl ? (
                  <img
                    src={annotatedImageUrl}
                    alt="Trecho da imagem com a palavra destacada em laranja"
                    className="max-w-full max-h-56 object-contain"
                  />
                ) : imageData && editingWord?.imageBbox ? (
                  <span className="text-xs text-muted-foreground py-4">Carregando...</span>
                ) : (
                  <span className="text-xs text-muted-foreground py-4">
                    Sem posição disponível
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-input">Correção</Label>
              <Input
                id="correction-input"
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCorrection();
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

