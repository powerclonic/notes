import { useState, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { processImageOcr, structureNote } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { CameraCapture } from '@/components/CameraCapture';
import { WordReviewInterface } from '@/components/WordReviewInterface';
import { NoteLibrary } from '@/components/NoteLibrary';
import { NoteEditor } from '@/components/NoteEditor';
import { Camera, Upload, Sparkle } from '@phosphor-icons/react';
import { Note, UncertainWord } from './types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type AppView = 'home' | 'camera' | 'processing' | 'review' | 'edit';

function App() {
  const [notes = [], setNotes] = useLocalStorage<Note[]>('notes', []);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [uncertainWords, setUncertainWords] = useState<UncertainWord[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<string>('new');
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
      const result = await structureNote(text);

      const newNote: Note = {
        id: Date.now().toString(),
        title: result.title || 'Nota sem título',
        content: result.content || text,
        originalImage: currentImage || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      
      toast.success('Nota salva com sucesso!', {
        description: newNote.title,
      });

      setCurrentView('home');
      setCurrentImage(null);
      setExtractedText('');
      setUncertainWords([]);
      setActiveTab('library');
    } catch (error) {
      toast.error('Erro ao estruturar nota. Salvando texto bruto...');
      
      const newNote: Note = {
        id: Date.now().toString(),
        title: 'Nota sem título',
        content: text,
        originalImage: currentImage || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      setCurrentView('home');
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle className="w-16 h-16 text-accent" weight="fill" />
            </motion.div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">Processando imagem...</h3>
              <p className="text-sm text-muted-foreground">
                A IA está analisando o texto da sua imagem
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'review') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto h-[calc(100vh-3rem)]">
          <WordReviewInterface
            text={extractedText}
            uncertainWords={uncertainWords}
            onComplete={handleReviewComplete}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'edit' && editingNote) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
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
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">NoteSnap</h1>
          <p className="text-lg text-muted-foreground">
            Transforme anotações escritas e slides em notas digitais estruturadas
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="new">Nova Nota</TabsTrigger>
            <TabsTrigger value="library">Biblioteca</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <Button
                    size="lg"
                    className="flex-1 h-32 text-lg bg-primary hover:bg-primary/90"
                    onClick={() => setCurrentView('camera')}
                  >
                    <Camera className="w-8 h-8 mr-3" weight="fill" />
                    Tirar Foto
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 h-32 text-lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mr-3" weight="fill" />
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

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-sm mb-2">💡 Dicas para melhores resultados:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use boa iluminação</li>
                    <li>• Mantenha a câmera estável</li>
                    <li>• Enquadre todo o texto</li>
                    <li>• Evite sombras e reflexos</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library" className="h-[calc(100vh-16rem)]">
            <Card className="h-full">
              <CardContent className="pt-6 h-full">
                <NoteLibrary
                  notes={notes}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
