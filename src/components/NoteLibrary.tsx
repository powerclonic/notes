import { Note, NOTE_TYPE_LABELS, NOTE_TYPE_ICONS, NoteType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash, PencilSimple, Image, CheckSquare, Square, GitMerge, X, Sparkle } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

interface NoteLibraryProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onMerge: (noteIds: string[]) => void;
  onGenerate: (noteIds: string[], prompt: string) => void;
}

const isValidNoteType = (type: unknown): type is NoteType =>
  typeof type === 'string' && type in NOTE_TYPE_LABELS;

export function NoteLibrary({ notes, onEdit, onDelete, onMerge, onGenerate }: NoteLibraryProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showGeneratePrompt, setShowGeneratePrompt] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setShowGeneratePrompt(false);
    setGeneratePrompt('');
  };

  const handleMerge = () => {
    onMerge(Array.from(selected));
    exitSelectMode();
  };

  const handleGenerateClick = () => {
    setShowGeneratePrompt(true);
  };

  const handleGenerateConfirm = () => {
    if (!generatePrompt.trim()) return;
    onGenerate(Array.from(selected), generatePrompt.trim());
    exitSelectMode();
  };

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Image className="w-10 h-10 text-muted-foreground" weight="duotone" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma nota ainda</h3>
          <p className="text-sm text-muted-foreground">
            Capture ou faça upload de uma imagem para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full gap-2">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-1 shrink-0">
          <div className="flex items-center justify-between">
          {selectMode ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} selecionada{selected.size !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                {selected.size >= 2 && !showGeneratePrompt && (
                  <Button size="sm" onClick={handleMerge} className="gap-1.5 h-8">
                    <GitMerge className="w-3.5 h-3.5" />
                    Juntar
                  </Button>
                )}
                {selected.size >= 1 && !showGeneratePrompt && (
                  <Button size="sm" variant="outline" onClick={handleGenerateClick} className="gap-1.5 h-8">
                    <Sparkle className="w-3.5 h-3.5" />
                    Gerar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={exitSelectMode} className="gap-1.5 h-8">
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {notes.length} nota{notes.length !== 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectMode(true)}
                className="gap-1.5 h-8 text-muted-foreground"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Selecionar
              </Button>
            </>
          )}
          </div>
          {showGeneratePrompt && (
            <div className="flex flex-col gap-2 p-2 border border-border rounded-lg bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Instrução para gerar nota:</p>
              <Textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="Ex: Crie um resumo comparativo das notas selecionadas..."
                className="text-sm min-h-[64px] resize-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowGeneratePrompt(false)} className="h-7">
                  Voltar
                </Button>
                <Button size="sm" onClick={handleGenerateConfirm} disabled={!generatePrompt.trim()} className="h-7 gap-1.5">
                  <Sparkle className="w-3.5 h-3.5" />
                  Gerar
                </Button>
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="grid gap-3 p-1">
            {notes.map((note) => {
              const isSelected = selected.has(note.id);
              return (
                <Card
                  key={note.id}
                  className={`hover:shadow-md transition-all duration-200 cursor-pointer group border-border/60 ${
                    isSelected ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(note.id);
                    } else {
                      onEdit(note);
                    }
                  }}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-3">
                      {selectMode && (
                        <div className="shrink-0 mt-0.5 text-primary">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" weight="fill" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {isValidNoteType(note.noteType) && (
                            <Badge variant="secondary" className="text-xs shrink-0 font-normal">
                              {NOTE_TYPE_ICONS[note.noteType]} {NOTE_TYPE_LABELS[note.noteType]}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base font-semibold leading-snug truncate">
                          {note.title}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {formatDistanceToNow(note.updatedAt, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </CardDescription>
                      </div>
                      {!selectMode && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(note);
                            }}
                          >
                            <PencilSimple className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(note.id);
                            }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      <MarkdownRenderer content={note.content} className="markdown-preview" />
                    </div>
                    {(note.originalImages && note.originalImages.length > 0) ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Image className="w-3 h-3" weight="fill" />
                        <span>
                          {note.originalImages.length > 1
                            ? `${note.originalImages.length} imagens originais`
                            : 'Imagem original anexada'}
                        </span>
                      </div>
                    ) : note.originalImage ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Image className="w-3 h-3" weight="fill" />
                        <span>Imagem original anexada</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  onDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
