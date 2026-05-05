import { useState, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { processImageOcr, structureNote } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/components/LoginPage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CameraCapture } from '@/components/CameraCapture';
import { WordReviewInterface } from '@/components/WordReviewInterface';
import { NoteLibrary } from '@/components/NoteLibrary';
import { NoteEditor } from '@/components/NoteEditor';
import { Camera, Upload, Sparkle, X, SignOut } from '@phosphor-icons/react';
import {
  Note,
  NoteType,
  NoteConfig,
  DetailLevel,
  WritingTone,
  UncertainWord,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_ICONS,
  DETAIL_LEVEL_LABELS,
  WRITING_TONE_LABELS,
  DEFAULT_NOTE_CONFIG,
} from './types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type AppView = 'home' | 'camera' | 'processing' | 'review' | 'edit';

const NOTE_TYPES: NoteType[] = ['anotacoes', 'ideias', 'mapa-mental', 'insights-corporativos'];
const DETAIL_LEVELS: DetailLevel[] = ['resumido', 'normal', 'detalhado'];
const WRITING_TONES: WritingTone[] = ['formal', 'neutro', 'casual'];

const BUILD_INFO = `v${__APP_VERSION__} · ${new Date(__BUILD_TIME__).toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})}`;

function App() {
  const { user, isLoading, logout } = useAuth();
  // Notes keyed per user to isolate data between accounts
  const notesKey = user ? `notes_${user.id}` : 'notes';
  const [notes = [], setNotes] = useLocalStorage<Note[]>(notesKey, []);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [uncertainWords, setUncertainWords] = useState<UncertainWord[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<string>('new');
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>('anotacoes');
  const [noteToUpdate, setNoteToUpdate] = useState<Note | null>(null);
  const [noteConfig, setNoteConfig] = useState<NoteConfig>(DEFAULT_NOTE_CONFIG);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = (imageData: string) => {
    setCurrentImage(imageData);
    setCurrentView('processing');
    processImage(imageData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCurrentImage(imageData);
        setCurrentView('processing');
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageData: string) => {
    try {
      const result = await processImageOcr(imageData);

      if (!result.fullText || result.fullText.trim() === '') {
        toast.error('Nenhum texto foi detectado na imagem. Tente outra foto.');
        setCurrentView('home');
        return;
      }

      setExtractedText(result.fullText);
      setUncertainWords(result.uncertainWords || []);

      if (result.uncertainWords && result.uncertainWords.length > 0) {
        setCurrentView('review');
        toast.info(`${result.uncertainWords.length} palavras precisam de revisão.`);
      } else {
        structureAndSaveNote(result.fullText);
      }
    } catch (error) {
      toast.error('Erro ao processar imagem. Tente novamente.');
      console.error(error);
      setCurrentView('home');
    }
  };

  const handleReviewComplete = (correctedText: string) => {
    structureAndSaveNote(correctedText);
  };

  const structureAndSaveNote = async (text: string) => {
    try {
      setCurrentView('processing');
      const existingNotePayload = noteToUpdate
        ? { title: noteToUpdate.title, content: noteToUpdate.content }
        : undefined;

      const result = await structureNote(text, selectedNoteType, existingNotePayload, noteConfig);

      if (noteToUpdate) {
        const updatedNote: Note = {
          ...noteToUpdate,
          title: result.title || noteToUpdate.title,
          content: result.content || text,
          noteType: selectedNoteType,
          originalImage: currentImage || noteToUpdate.originalImage,
          updatedAt: Date.now(),
        };
        setNotes((currentNotes = []) =>
          currentNotes.map((n) => (n.id === updatedNote.id ? updatedNote : n))
        );
        toast.success('Nota atualizada com sucesso!', { description: updatedNote.title });
      } else {
        const newNote: Note = {
          id: Date.now().toString(),
          title: result.title || 'Nota sem título',
          content: result.content || text,
          noteType: selectedNoteType,
          originalImage: currentImage || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setNotes((currentNotes) => [newNote, ...currentNotes]);
        toast.success('Nota salva com sucesso!', { description: newNote.title });
      }

      setCurrentView('home');
      setCurrentImage(null);
      setExtractedText('');
      setUncertainWords([]);
      setNoteToUpdate(null);
      setActiveTab('library');
    } catch (error) {
      toast.error('Erro ao estruturar nota. Salvando texto bruto...');

      const newNote: Note = {
        id: Date.now().toString(),
        title: 'Nota sem título',
        content: text,
        noteType: selectedNoteType,
        originalImage: currentImage || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      setCurrentView('home');
      setNoteToUpdate(null);
      setActiveTab('library');
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setCurrentView('edit');
  };

  const handleSaveEdit = (updatedNote: Note) => {
    setNotes((currentNotes = []) =>
      currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note))
    );
    toast.success('Nota atualizada com sucesso!');
    setEditingNote(null);
    setCurrentView('home');
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((currentNotes = []) => currentNotes.filter((note) => note.id !== noteId));
    toast.success('Nota excluída com sucesso!');
  };

  const handleMergeNotes = async (noteIds: string[]) => {
    const toMerge = notes.filter((n) => noteIds.includes(n.id));
    if (toMerge.length < 2) return;

    const combinedText = toMerge
      .map((n) => `## ${n.title}\n\n${n.content}`)
      .join('\n\n---\n\n');

    const mergeNoteType = toMerge[0].noteType ?? selectedNoteType;

    try {
      setCurrentView('processing');
      const result = await structureNote(combinedText, mergeNoteType, undefined, noteConfig);
      const mergedNote: Note = {
        id: crypto.randomUUID(),
        title: result.title || 'Nota mesclada',
        content: result.content || combinedText,
        noteType: mergeNoteType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setNotes((currentNotes = []) => [mergedNote, ...currentNotes]);
      toast.success('Notas juntadas com sucesso!', { description: mergedNote.title });
    } catch {
      toast.error('Erro ao juntar notas. Tente novamente.');
    } finally {
      setCurrentView('home');
      setActiveTab('library');
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Sparkle className="w-10 h-10 text-accent" weight="fill" />
        </motion.div>
      </div>
    );
  }

  // Gate all app views behind authentication
  if (!user) {
    return <LoginPage />;
  }

  if (currentView === 'camera') {
    return (
      <div className="h-screen">
        <CameraCapture
          onCapture={handleImageCapture}
          onCancel={() => setCurrentView('home')}
        />
      </div>
    );
  }

  if (currentView === 'processing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle className="w-14 h-14 text-accent" weight="fill" />
            </motion.div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold">Processando...</h3>
              <p className="text-sm text-muted-foreground">
                A IA está organizando sua nota
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'review') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-2xl mx-auto h-[calc(100vh-2rem)]">
          <WordReviewInterface
            text={extractedText}
            uncertainWords={uncertainWords}
            imageData={currentImage}
            onComplete={handleReviewComplete}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'edit' && editingNote) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <NoteEditor
            note={editingNote}
            onSave={handleSaveEdit}
            onCancel={() => {
              setEditingNote(null);
              setCurrentView('home');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">NoteSnap</h1>
            <p className="text-sm text-muted-foreground">
              Transforme imagens em notas estruturadas com IA
            </p>
            <p className="text-xs text-muted-foreground/60">{BUILD_INFO}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 text-muted-foreground hover:text-foreground"
            onClick={logout}
            title={`Sair (${user.email})`}
          >
            <SignOut className="w-5 h-5" />
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Nova Nota</TabsTrigger>
            <TabsTrigger value="library">
              Biblioteca
              {notes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">
                  {notes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-3">
            {/* Note type selector */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Tipo de nota</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NOTE_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedNoteType(type)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          selectedNoteType === type
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        <span className="text-base">{NOTE_TYPE_ICONS[type]}</span>
                        <span className="truncate">{NOTE_TYPE_LABELS[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detail level */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Nível de detalhe</p>
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
                </div>

                {/* Writing tone */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Tom de escrita</p>
                  <div className="grid grid-cols-3 gap-2">
                    {WRITING_TONES.map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setNoteConfig((c) => ({ ...c, tone }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          noteConfig.tone === tone
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {WRITING_TONE_LABELS[tone]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Include examples toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Incluir exemplos práticos</p>
                  <button
                    onClick={() => setNoteConfig((c) => ({ ...c, includeExamples: !c.includeExamples }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      noteConfig.includeExamples ? 'bg-primary' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={noteConfig.includeExamples}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        noteConfig.includeExamples ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Update existing note selector */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Atualizar nota existente{' '}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </p>
                  {noteToUpdate ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{noteToUpdate.title}</p>
                        {noteToUpdate.noteType && (
                          <p className="text-xs text-muted-foreground">
                            {NOTE_TYPE_ICONS[noteToUpdate.noteType]} {NOTE_TYPE_LABELS[noteToUpdate.noteType]}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setNoteToUpdate(null)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : notes.length > 0 ? (
                    <Select
                      value=""
                      onValueChange={(id) => {
                        const found = notes.find((n) => n.id === id);
                        if (found) {
                          setNoteToUpdate(found);
                          if (found.noteType) setSelectedNoteType(found.noteType);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar nota para atualizar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {notes.map((note) => (
                          <SelectItem key={note.id} value={note.id}>
                            <span className="flex items-center gap-2">
                              {note.noteType && (
                                <span aria-label={NOTE_TYPE_LABELS[note.noteType]}>
                                  {NOTE_TYPE_ICONS[note.noteType]}
                                </span>
                              )}
                              <span className="truncate max-w-[200px] md:max-w-[300px]">{note.title}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma nota salva ainda
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Capture/Upload buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-24 text-base flex-col gap-2 bg-primary hover:bg-primary/90"
                onClick={() => setCurrentView('camera')}
              >
                <Camera className="w-7 h-7" weight="fill" />
                Tirar Foto
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-24 text-base flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-7 h-7" weight="fill" />
                Fazer Upload
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Tips */}
            <div className="px-3 py-2.5 bg-muted/60 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">💡 Dicas:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Use boa iluminação e enquadre todo o texto</li>
                <li>• Mantenha a câmera estável</li>
                <li>• Evite sombras e reflexos</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="library" className="h-[calc(100vh-14rem)]">
            <NoteLibrary
              notes={notes}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
              onMerge={handleMergeNotes}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;

