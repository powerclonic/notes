import { useState } from 'react';
import { Presentation } from '@/lib/slideDsl';
import { SlideCard } from '@/components/SlideCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CaretLeft, CaretRight, Eye, EyeSlash } from '@phosphor-icons/react';

const LAYOUT_LABELS: Record<string, string> = {
  title: 'Título',
  section: 'Seção',
  bullets: 'Tópicos',
  'image-text': 'Imagem + Texto',
  'image-bullets': 'Imagem + Tópicos',
  'two-col': 'Duas Colunas',
  quote: 'Citação',
  closing: 'Encerramento',
};

interface SlideDeckProps {
  presentation: Presentation;
}

export function SlideDeck({ presentation }: SlideDeckProps) {
  const { slides } = presentation;
  const [activeIndex, setActiveIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Nenhum slide gerado.
      </div>
    );
  }

  const active = slides[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < slides.length - 1;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Active slide preview */}
      <div className="w-full">
        <SlideCard slide={active} showNotes={showNotes} index={activeIndex + 1} />
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            disabled={!hasPrev}
          >
            <CaretLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
            {activeIndex + 1} / {slides.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
            disabled={!hasNext}
          >
            <CaretRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {LAYOUT_LABELS[active.layout] ?? active.layout}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={() => setShowNotes((v) => !v)}
          >
            {showNotes ? (
              <EyeSlash className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span className="text-xs">Notas</span>
          </Button>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`shrink-0 w-32 rounded-md overflow-hidden border-2 transition-all ${
              i === activeIndex
                ? 'border-primary shadow-md'
                : 'border-transparent opacity-60 hover:opacity-90 hover:border-border'
            }`}
            title={`Slide ${i + 1} — ${LAYOUT_LABELS[slide.layout] ?? slide.layout}`}
          >
            <SlideCard slide={slide} />
          </button>
        ))}
      </div>
    </div>
  );
}
