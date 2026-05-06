import { useEffect, useState } from 'react';
import { getTokenStats, TokenStats } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Sparkle, ArrowClockwise } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

const OPERATION_LABELS: Record<string, string> = {
  ocr: 'OCR (imagem)',
  'ocr-bbox': 'OCR (bounding box)',
  'ocr-batch': 'OCR (lote)',
  structure: 'Estruturar nota',
  generate: 'Gerar nota',
  slides: 'Gerar slides',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function TokenStats() {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getTokenStats()
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Sparkle className="w-8 h-8 text-accent" weight="fill" />
        </motion.div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">Erro ao carregar estatísticas.</p>
        <button
          onClick={load}
          className="text-xs text-primary flex items-center gap-1 hover:underline"
        >
          <ArrowClockwise className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { summary, byOperation, byNote } = stats;
  const maxOpTokens = byOperation.length > 0 ? Math.max(...byOperation.map((o) => o.totalTokens)) : 1;
  const maxNoteTokens = byNote.length > 0 ? Math.max(...byNote.map((n) => n.totalTokens)) : 1;

  return (
    <div className="space-y-6 px-4 pb-6">
      {/* Summary */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Resumo geral</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{fmt(summary.totalTokens)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{fmt(summary.promptTokens)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Entrada</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{fmt(summary.completionTokens)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Saída</p>
          </div>
        </div>
      </div>

      {/* By operation */}
      {byOperation.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Por operação</p>
          <div className="space-y-3">
            {byOperation.map((op) => (
              <div key={op.operation}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground">
                    {OPERATION_LABELS[op.operation] ?? op.operation}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(op.totalTokens)}</span>
                </div>
                <Progress value={maxOpTokens > 0 ? (op.totalTokens / maxOpTokens) * 100 : 0} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By note */}
      {byNote.filter((n) => n.noteId !== null).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Por nota</p>
          <div className="space-y-3">
            {byNote
              .filter((n) => n.noteId !== null)
              .slice(0, 10)
              .map((n) => (
                <div key={n.noteId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground truncate max-w-[180px]">
                      {n.noteTitle ?? 'Nota sem título'}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {fmt(n.totalTokens)}
                    </span>
                  </div>
                  <Progress value={maxNoteTokens > 0 ? (n.totalTokens / maxNoteTokens) * 100 : 0} />
                </div>
              ))}
          </div>
        </div>
      )}

      {summary.totalTokens === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum uso de tokens registrado ainda.
        </p>
      )}

      <button
        onClick={load}
        className="text-xs text-muted-foreground flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
      >
        <ArrowClockwise className="w-3 h-3" />
        Atualizar
      </button>
    </div>
  );
}
