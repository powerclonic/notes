import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Note, NoteType, NOTE_TYPE_LABELS, NOTE_TYPE_ICONS } from '@/types';
import { ArrowLeft, FloppyDisk, Eye, PencilSimple } from '@phosphor-icons/react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

const isValidNoteType = (type: unknown): type is NoteType =>
  typeof type === 'string' && type in NOTE_TYPE_LABELS;

interface NoteEditorProps {
  note: Note;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPreview, setIsPreview] = useState(false);

  const handleSave = () => {
    onSave({
      ...note,
      title,
      content,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <Button onClick={onCancel} variant="ghost" size="icon" className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold text-foreground flex-1 truncate">Editar Nota</h2>
        {isValidNoteType(note.noteType) && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {NOTE_TYPE_ICONS[note.noteType]} {NOTE_TYPE_LABELS[note.noteType]}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-4 flex-1">
        <div>
          <Label htmlFor="note-title" className="text-sm text-muted-foreground mb-1.5 block">
            Título
          </Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Digite um título para a nota..."
            className="text-base font-semibold"
          />
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="note-content" className="text-sm text-muted-foreground">
              Conteúdo
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className="h-7 px-2 text-xs gap-1.5"
            >
              {isPreview ? (
                <>
                  <PencilSimple className="w-3.5 h-3.5" />
                  Editar
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </>
              )}
            </Button>
          </div>

          {isPreview ? (
            <Card className="flex-1">
              <CardContent className="pt-4 pb-4">
                {content ? (
                  <MarkdownRenderer
                    content={content}
                    className="text-sm text-foreground min-h-[200px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic min-h-[200px]">Sem conteúdo</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o conteúdo da nota (suporta Markdown)..."
              className="flex-1 min-h-[250px] resize-none leading-relaxed text-sm font-mono"
            />
          )}
        </div>

        {(note.originalImages && note.originalImages.length > 0) ? (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Imagens Originais ({note.originalImages.length})
            </Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {note.originalImages.map((src, idx) => (
                <img
                  key={idx}
                  src={src}
                  alt={`Original ${idx + 1}`}
                  className="h-32 w-auto shrink-0 object-contain rounded-lg border border-border"
                />
              ))}
            </div>
          </div>
        ) : note.originalImage ? (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Imagem Original</Label>
            <img
              src={note.originalImage}
              alt="Original"
              className="w-full max-h-48 object-contain rounded-lg border border-border"
            />
          </div>
        ) : null}
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-border">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90">
          <FloppyDisk className="w-4 h-4 mr-2" weight="fill" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
