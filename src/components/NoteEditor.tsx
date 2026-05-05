import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Note } from '@/types';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';

interface NoteEditorProps {
  note: Note;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

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
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onCancel} variant="ghost" size="icon">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Editar Nota</h2>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Título</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-6">
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Digite um título para a nota..."
            className="text-lg font-semibold"
          />

          <div className="flex-1 flex flex-col gap-2">
            <Label htmlFor="note-content" className="text-sm text-muted-foreground">
              Conteúdo
            </Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o conteúdo da nota..."
              className="flex-1 min-h-[300px] resize-none leading-relaxed"
            />
          </div>

          {note.originalImage && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Imagem Original</Label>
              <img
                src={note.originalImage}
                alt="Original"
                className="w-full max-h-64 object-contain rounded-lg border border-border"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 mt-6">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90">
          <FloppyDisk className="w-5 h-5 mr-2" weight="fill" />
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
