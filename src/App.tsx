import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { processImageOcr, processImageOcrBatch, structureNote, generateNoteFromNotes, generateSlides, getNotes, saveNote, patchNote, removeNote } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/components/LoginPage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { compressToWebP, buildImageGrid, chunkArray, getGridLayout } from '@/lib/imageUtils';

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [uncertainWords, setUncertainWords] = useState<UncertainWord[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<string>('new');
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>('anotacoes');
  const [noteToUpdate, setNoteToUpdate] = useState<Note | null>(null);
  const [noteConfig, setNoteConfig] = useState<NoteConfig>(DEFAULT_NOTE_CONFIG);
  const [noteTheme, setNoteTheme] = useState<string>('');
  const [showSlidesForm, setShowSlidesForm] = useState(false);
  const [slidesPrompt, setSlidesPrompt] = useState('');
  const [slidesContext, setSlidesContext] = useState('');
  const [slidesContextError, setSlidesContextError] = useState(false);
  const [slidesSelectedNotes, setSlidesSelectedNotes] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load notes from backend when user is authenticated
  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    getNotes()
      .then((apiNotes) =>
        setNotes(
          apiNotes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            noteType: n.noteType as NoteType | undefined,
            originalImage: n.originalImage,
            originalImages: n.originalImages,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          }))
        )
      )
      .catch(() => toast.error('Erro ao carregar notas.'))
      .finally(() => setNotesLoading(false));
  }, [user]);

  const handleImageCapture = (imageData: string | string[]) => {
    const images = Array.isArray(imageData) ? imageData : [imageData];
    setCurrentImages(images);
    setCurrentView('processing');
    processImages(images);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const readers = fileList.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers)
      .then((rawImages) =>
        // Compress uploaded images to WebP before processing
        Promise.all(rawImages.map((img) => compressToWebP(img, 1280, 0.75)))
      )
      .then((images) => {
        setCurrentImages(images);
        setCurrentView('processing');
        processImages(images);
      })
      .finally(() => {
        // Reset after processing so users can retry with the same files if needed
        event.target.value = '';
      });
  };

  const processImages = async (images: string[]) => {
    try {
      const allTexts: string[] = [];
      const allUncertainWords: UncertainWord[] = [];
      let textOffset = 0;

      // Split into groups of up to 4 images
      const groups = chunkArray(images, 4);

      for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        // Report progress by group: "group X of Y (images A–B)"
        setProcessingProgress({ current: g + 1, total: groups.length });

        let groupResults: Array<{ fullText: string; uncertainWords: UncertainWord[]; imageType?: string }>;

        if (group.length === 1) {
          // Single image: use existing endpoint (preserves bboxes for visual review)
          const result = await processImageOcr(group[0], noteTheme || undefined);
          groupResults = [result];
        } else {
          // Multiple images: compose grid and call batch endpoint
          const { cols, rows } = getGridLayout(group.length);
          const gridData = await buildImageGrid(group, cols, rows, 640, 0.82);
          const batchResult = await processImageOcrBatch(
            gridData,
            cols,
            rows,
            group.length,
            noteTheme || undefined
          );
          groupResults = batchResult.images;
        }

        for (const result of groupResults) {
          if (result.fullText && result.fullText.trim() !== '') {
            allTexts.push(result.fullText);

            // Offset uncertain word indices for combined text
            for (const w of result.uncertainWords || []) {
              allUncertainWords.push({
                ...w,
                startIndex: w.startIndex + textOffset,
                endIndex: w.endIndex + textOffset,
              });
            }
            textOffset += result.fullText.length + '\n\n---\n\n'.length;
          }
        }
      }

      setProcessingProgress(null);

      if (allTexts.length === 0) {
        toast.error('Nenhum texto foi detectado nas imagens. Tente outras fotos.');
        setCurrentView('home');
        return;
      }

      const combinedText = allTexts.join('\n\n---\n\n');
      setExtractedText(combinedText);
      setUncertainWords(allUncertainWords);

      if (allUncertainWords.length > 0) {
        setCurrentView('review');
        toast.info(`${allUncertainWords.length} palavras precisam de revisão.`);
      } else {
        structureAndSaveNote(combinedText);
      }
    } catch (error) {
      toast.error('Erro ao processar imagem. Tente novamente.');
      console.error(error);
      setProcessingProgress(null);
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

      const result = await structureNote(text, selectedNoteType, existingNotePayload, noteConfig, noteTheme || undefined);

      if (noteToUpdate) {
        const fields = {
          title: result.title || noteToUpdate.title,
          content: result.content || text,
          noteType: selectedNoteType,
          originalImage: currentImages[0] || noteToUpdate.originalImage,
          originalImages: currentImages.length > 0 ? currentImages : noteToUpdate.originalImages,
        };
        const saved = await patchNote(noteToUpdate.id, fields);
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteToUpdate.id
              ? { ...n, ...fields, updatedAt: saved.updatedAt }
              : n
          )
        );
        toast.success('Nota atualizada com sucesso!', { description: fields.title });
      } else {
        const now = Date.now();
        const newNote: Note = {
          id: uuidv4(),
          title: result.title || 'Nota sem título',
          content: result.content || text,
          noteType: selectedNoteType,
          originalImage: currentImages[0] || undefined,
          originalImages: currentImages.length > 0 ? currentImages : undefined,
          createdAt: now,
          updatedAt: now,
        };
        await saveNote({ ...newNote, noteType: newNote.noteType });
        setNotes((prev) => [newNote, ...prev]);
        toast.success('Nota salva com sucesso!', { description: newNote.title });
      }

      setCurrentView('home');
      setCurrentImages([]);
      setExtractedText('');
      setUncertainWords([]);
      setNoteToUpdate(null);
      setNoteTheme('');
      setActiveTab('library');
    } catch (error) {
      toast.error('Erro ao estruturar nota. Salvando texto bruto...');

      const now = Date.now();
      const newNote: Note = {
        id: uuidv4(),
        title: 'Nota sem título',
        content: text,
        noteType: selectedNoteType,
        originalImage: currentImages[0] || undefined,
        originalImages: currentImages.length > 0 ? currentImages : undefined,
        createdAt: now,
        updatedAt: now,
      };

      saveNote({ ...newNote, noteType: newNote.noteType }).catch((err) => {
        console.error('Failed to persist fallback note:', err);
      });
      setNotes((prev) => [newNote, ...prev]);
      setCurrentView('home');
      setNoteToUpdate(null);
      setNoteTheme('');
      setActiveTab('library');
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setCurrentView('edit');
  };

  const handleSaveEdit = async (updatedNote: Note) => {
    try {
      const saved = await patchNote(updatedNote.id, {
        title: updatedNote.title,
        content: updatedNote.content,
        noteType: updatedNote.noteType,
        originalImage: updatedNote.originalImage,
        originalImages: updatedNote.originalImages,
      });
      setNotes((prev) =>
        prev.map((note) =>
          note.id === updatedNote.id ? { ...updatedNote, updatedAt: saved.updatedAt } : note
        )
      );
      toast.success('Nota atualizada com sucesso!');
    } catch {
      toast.error('Erro ao atualizar nota. Tente novamente.');
    }
    setEditingNote(null);
    setCurrentView('home');
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await removeNote(noteId);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast.success('Nota excluída com sucesso!');
    } catch {
      toast.error('Erro ao excluir nota. Tente novamente.');
    }
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
      const now = Date.now();
      const mergedNote: Note = {
        id: uuidv4(),
        title: result.title || 'Nota mesclada',
        content: result.content || combinedText,
        noteType: mergeNoteType,
        createdAt: now,
        updatedAt: now,
      };
      await saveNote({ ...mergedNote, noteType: mergedNote.noteType });
      setNotes((prev) => [mergedNote, ...prev]);
      toast.success('Notas juntadas com sucesso!', { description: mergedNote.title });
    } catch {
      toast.error('Erro ao juntar notas. Tente novamente.');
    } finally {
      setCurrentView('home');
      setActiveTab('library');
    }
  };

  const handleGenerateFromNotes = async (noteIds: string[], prompt: string) => {
    const sourceNotes = notes.filter((n) => noteIds.includes(n.id));
    if (sourceNotes.length === 0) return;

    const genNoteType = sourceNotes[0].noteType ?? selectedNoteType;

    try {
      setCurrentView('processing');
      const result = await generateNoteFromNotes(
        sourceNotes.map((n) => ({ title: n.title, content: n.content })),
        prompt,
        genNoteType,
        noteConfig
      );
      const now = Date.now();
      const newNote: Note = {
        id: uuidv4(),
        title: result.title || 'Nota gerada',
        content: result.content || '',
        noteType: genNoteType,
        createdAt: now,
        updatedAt: now,
      };
      await saveNote({ ...newNote, noteType: newNote.noteType });
      setNotes((prev) => [newNote, ...prev]);
      toast.success('Nota gerada com sucesso!', { description: newNote.title });
    } catch {
      toast.error('Erro ao gerar nota. Tente novamente.');
    } finally {
      setCurrentView('home');
      setActiveTab('library');
    }
  };

  const handleGenerateSlides = async () => {
    if (!slidesContext.trim()) {
      setSlidesContextError(true);
      return;
    }

    try {
      setCurrentView('processing');

      // Get selected notes for context
      const selectedNotesForSlides = notes.filter((n) => slidesSelectedNotes.has(n.id));
      const notesContext = selectedNotesForSlides.length > 0
        ? selectedNotesForSlides.map((n) => `## ${n.title}\n\n${n.content}`).join('\n\n---\n\n')
        : undefined;

      const result = await generateSlides(
        slidesPrompt || slidesContext,
        slidesContext,
        noteConfig,
        notesContext
      );
      const now = Date.now();
      const newNote: Note = {
        id: uuidv4(),
        title: result.title || 'Slides',
        content: result.content || '',
        noteType: 'slides',
        createdAt: now,
        updatedAt: now,
      };
      await saveNote({ ...newNote, noteType: newNote.noteType });
      setNotes((prev) => [newNote, ...prev]);
      toast.success('Slides gerados com sucesso!', { description: newNote.title });
      setSlidesPrompt('');
      setSlidesContext('');
      setSlidesSelectedNotes(new Set());
      setShowSlidesForm(false);
      setActiveTab('library');
    } catch {
      toast.error('Erro ao gerar slides. Tente novamente.');
    } finally {
      setCurrentView('home');
    }
  };


  if (isLoading || notesLoading) {
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
                {processingProgress && processingProgress.total > 1
                  ? `Processando ${processingProgress.current} de ${processingProgress.total} imagens...`
                  : 'A IA está organizando sua nota'}
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
            imageData={currentImages[0] ?? null}
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
            {/* Capture/Upload buttons - Primary action */}
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
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Note configuration */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                {/* Note type selector */}
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

                {/* Theme input */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Temática <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </label>
                  <Input
                    value={noteTheme}
                    onChange={(e) => setNoteTheme(e.target.value)}
                    placeholder="Ex: Química orgânica, Reunião de vendas..."
                    className="text-sm"
                  />
                </div>

                {/* Update existing note selector */}
                {notes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">
                      Atualizar nota existente{' '}
                      <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
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
                    ) : (
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
                          <SelectValue placeholder="Selecionar nota..." />
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
                    )}
                  </div>
                )}

                {/* Collapsible advanced options */}
                <details className="group">
                  <summary className="text-sm font-medium text-muted-foreground cursor-pointer list-none flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <span className="text-xs transform group-open:rotate-90 transition-transform">▶</span>
                    Opções avançadas
                  </summary>
                  <div className="mt-3 space-y-3 pt-3 border-t border-border">
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
                  </div>
                </details>
              </CardContent>
            </Card>

            {/* Slide mode */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">🎞️ Modo Slide</p>
                    <p className="text-xs text-muted-foreground">Gere slides baseados em suas notas</p>
                  </div>
                  <Button
                    size="sm"
                    variant={showSlidesForm ? 'secondary' : 'outline'}
                    onClick={() => setShowSlidesForm((v) => !v)}
                    className="gap-1.5 h-8"
                  >
                    <Sparkle className="w-3.5 h-3.5" />
                    Criar Slides
                  </Button>
                </div>
                {showSlidesForm && (
                  <div className="space-y-3 mt-3 border-t border-border pt-3">
                    {notes.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                          Notas de referência <span className="text-muted-foreground font-normal">(opcional)</span>
                        </label>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto border border-border rounded-lg p-2 bg-muted/20">
                          {notes.map((note) => (
                            <label
                              key={note.id}
                              className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={slidesSelectedNotes.has(note.id)}
                                onChange={(e) => {
                                  setSlidesSelectedNotes((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(note.id);
                                    else next.delete(note.id);
                                    return next;
                                  });
                                }}
                                className="w-3.5 h-3.5"
                              />
                              <span className="flex-1 truncate text-xs">{note.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Onde será usada? <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={slidesContext}
                        onChange={(e) => {
                          setSlidesContext(e.target.value);
                          if (e.target.value.trim()) setSlidesContextError(false);
                        }}
                        placeholder="Ex: Aula de química para o ensino médio"
                        className={`text-sm ${slidesContextError ? 'border-destructive' : ''}`}
                      />
                      {slidesContextError && (
                        <p className="text-xs text-destructive mt-1">Este campo é obrigatório.</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Conteúdo adicional <span className="text-muted-foreground font-normal">(opcional)</span>
                      </label>
                      <Textarea
                        value={slidesPrompt}
                        onChange={(e) => setSlidesPrompt(e.target.value)}
                        placeholder="Tópicos extras ou instruções específicas..."
                        className="text-sm min-h-[56px] resize-none"
                      />
                    </div>
                    <Button
                      onClick={handleGenerateSlides}
                      disabled={!slidesContext.trim()}
                      className="w-full gap-1.5"
                    >
                      <Sparkle className="w-4 h-4" />
                      Gerar Slides
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <div className="px-3 py-2.5 bg-muted/60 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">💡 Dicas:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Use boa iluminação e enquadre todo o texto</li>
                <li>• Mantenha a câmera estável</li>
                <li>• Evite sombras e reflexos</li>
                <li>• Selecione múltiplas imagens para uma única nota</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="library" className="h-[calc(100vh-14rem)]">
            <NoteLibrary
              notes={notes}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
              onMerge={handleMergeNotes}
              onGenerate={handleGenerateFromNotes}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;

