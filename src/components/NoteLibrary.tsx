import { Note, NOTE_TYPE_LABELS, NOTE_TYPE_ICONS } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash, PencilSimple, Image } from '@phosphor-icons/react';
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
}

export function NoteLibrary({ notes, onEdit, onDelete }: NoteLibraryProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      <ScrollArea className="h-full">
        <div className="grid gap-3 p-1">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="hover:shadow-md transition-all duration-200 cursor-pointer group border-border/60"
              onClick={() => onEdit(note)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {note.noteType && (
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
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  <MarkdownRenderer content={note.content} className="markdown-preview" />
                </div>
                {note.originalImage && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Image className="w-3 h-3" weight="fill" />
                    <span>Imagem original anexada</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

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
