import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Note, NoteConfig, DEFAULT_NOTE_CONFIG, DETAIL_LEVEL_LABELS, DetailLevel } from '@/types';
import { generateSlides, saveNote } from '@/lib/api';
import { parseSlideDsl, Presentation } from '@/lib/slideDsl';
import { SlideDeck } from '@/components/SlideDeck';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Sparkle, FloppyDisk, ArrowCounterClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const DETAIL_LEVELS: DetailLevel[] = ['resumido', 'normal', 'detalhado'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlidesWorkspaceProps {
  /** All user notes available as reference context */
  notes: Note[];
  /** Called after a slides note is saved — receives the new note */
  onSave: (note: Note) => void;
  /** Navigate back to home */
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlidesWorkspace({ notes, onSave, onBack }: SlidesWorkspaceProps) {
  // Form state
  const [context, setContext] = useState('');
  const [contextError, setContextError] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [noteConfig, setNoteConfig] = useState<NoteConfig>(DEFAULT_NOTE_CONFIG);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [rawDsl, setRawDsl] = useState('');
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGenerate = async () => {
    if (!context.trim()) {
      setContextError(true);
      return;
    }

    const noteId = uuidv4();
    setLoading(true);
    setPresentation(null);
    setRawDsl('');

    try {
      const contextNotes = notes.filter((n) => selectedNotes.has(n.id));
      const notesContext =
        contextNotes.length > 0
          ? contextNotes.map((n) => `## ${n.title}\n\n${n.content}`).join('\n\n---\n\n')
          : undefined;

      const result = await generateSlides(
        prompt || context,
        context,
        noteConfig,
        notesContext,
        noteId
      );

      const dsl = result.content;
      const parsed = parseSlideDsl(dsl);

      setRawDsl(dsl);
      setPresentation(parsed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar slides. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!presentation || !rawDsl) return;
    setSaving(true);
    try {
      const now = Date.now();
      const newNote: Note = {
        id: uuidv4(),
        title: presentation.title,
        content: rawDsl,
        noteType: 'slides',
        createdAt: now,
        updatedAt: now,
      };
      await saveNote({ ...newNote, noteType: 'slides' });
      onSave(newNote);
      toast.success('Slides salvos com sucesso!', { description: newNote.title });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar slides.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPresentation(null);
    setRawDsl('');
  };

  const toggleNoteSelection = (id: string) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">🎞️ Slides</h2>
            <p className="text-xs text-muted-foreground">Crie apresentações a partir das suas notas</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-14 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle className="w-12 h-12 text-accent" weight="fill" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Montando sua apresentação…</p>
          </div>
        )}

        {/* Generated deck */}
        {!loading && presentation && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold truncate">{presentation.title}</h3>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={handleReset}
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" />
                  Refazer
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <FloppyDisk className="w-3.5 h-3.5" />
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
            <SlideDeck presentation={presentation} />
          </div>
        )}

        {/* Creation form — shown while no deck is generated */}
        {!loading && !presentation && (
          <div className="space-y-4">
            {/* Context */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Contexto da apresentação{' '}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={context}
                    onChange={(e) => {
                      setContext(e.target.value);
                      if (e.target.value.trim()) setContextError(false);
                    }}
                    placeholder="Ex: Aula de química orgânica para o ensino médio"
                    className={contextError ? 'border-destructive' : ''}
                  />
                  {contextError && (
                    <p className="text-xs text-destructive mt-1">Este campo é obrigatório.</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Instruções adicionais{' '}
                    <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Tópicos extras, estilo, estrutura desejada…"
                    className="text-sm min-h-[72px] resize-none"
                  />
                </div>

                {/* Detail level */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Quantidade de slides</p>
                  <div className="grid grid-cols-3 gap-2">
                    {DETAIL_LEVELS.map((level) => (
                      <button
                        key={level}
                        onClick={() => setNoteConfig((c) => ({ ...c, detailLevel: level }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          noteConfig.detailLevel === level
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {DETAIL_LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {noteConfig.detailLevel === 'resumido' && '3–4 slides'}
                    {noteConfig.detailLevel === 'normal' && '5–7 slides'}
                    {noteConfig.detailLevel === 'detalhado' && '8–12 slides'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reference notes */}
            {notes.length > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Notas de referência{' '}
                    <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-muted/20">
                    {notes
                      .filter((n) => n.noteType !== 'slides')
                      .map((note) => (
                        <label
                          key={note.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNotes.has(note.id)}
                            onChange={() => toggleNoteSelection(note.id)}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs truncate text-foreground">{note.title}</span>
                        </label>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!context.trim()}
              className="w-full gap-2"
              size="lg"
            >
              <Sparkle className="w-4 h-4" weight="fill" />
              Gerar Apresentação
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
