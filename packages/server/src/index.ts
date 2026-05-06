import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { signToken, requireAuth, AuthRequest } from './auth.js';
import { findByEmail, findById, createUser } from './users.js';
import { getNotesByUser, createNote, updateNote, deleteNote } from './notes.js';
import { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust the first proxy so express-rate-limit can correctly read the client IP
// from the X-Forwarded-For header (required when running behind a reverse proxy).
app.set('trust proxy', 1);

// Pre-generate a dummy hash at startup for constant-time login comparison.
// This ensures the same bcrypt cost factor is always used regardless of code changes.
const DUMMY_HASH_PROMISE: Promise<string> = bcrypt.hash('startup-dummy-value', 12);

app.use(
  cors({
    origin: [
      'http://localhost:5000',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173',
      'https://notes.dresch.dev.br',
      'https://api-notes.dresch.dev.br',
    ],
  })
);
app.use(express.json({ limit: '50mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PT_BR = 'Responda em pt-BR.';

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** General API limiter – 120 requests per 15 minutes per IP */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

/** Auth endpoints – 10 attempts per 15 minutes per IP (brute-force protection) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos.' },
});

/** OCR endpoint – 30 requests per hour per IP (expensive OpenAI call) */
const ocrLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de processamento de imagens atingido. Tente novamente em 1 hora.' },
});

/** Structure endpoint – 60 requests per hour per IP */
const structureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de estruturação de notas atingido. Tente novamente em 1 hora.' },
});

app.use('/api', generalLimiter);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 * Body: { email: string, password: string }
 * Response: { token: string, user: { id, email } }
 */
app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      return;
    }

    // Bounded length check before regex to prevent ReDoS
    if (email.length > 254 || password.length > 128) {
      res.status(400).json({ error: 'Email ou senha inválidos.' });
      return;
    }

    // Validate basic email structure: local@domain.tld
    // Bounded quantifiers to prevent ReDoS; allows subdomains and ccTLDs (e.g. co.uk)
    const emailRegex = /^[^\s@]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Email inválido.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
      return;
    }

    if (await findByEmail(email)) {
      res.status(409).json({ error: 'Email já cadastrado.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(uuidv4(), email, passwordHash);
    const token = signToken({ sub: user.id, email: user.email });

    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { token: string, user: { id, email } }
 */
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      return;
    }

    const user = await findByEmail(email);
    // Always run bcrypt.compare to ensure constant-time response and prevent user-enumeration
    const dummyHash = await DUMMY_HASH_PROMISE;
    const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

/**
 * GET /api/auth/me
 * Response: { id, email }
 */
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await findById(req.user!.sub);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }
  res.json({ id: user.id, email: user.email });
});

interface UncertainWordRaw {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions?: string[];
  imageBbox?: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}

/**
 * POST /api/ocr
 * Requires authentication.
 * Body: { imageData: string, theme?: string }  – base64 data-URL (e.g. data:image/jpeg;base64,...)
 * Response: { fullText: string, uncertainWords: UncertainWord[], imageType: string }
 *
 * Uses a two-pass approach:
 *   Pass 1 – extract text, detect image type, and identify uncertain words (no coordinates).
 *   Pass 2 – given the same image and the list of uncertain words, locate
 *            each one precisely and return accurate bounding boxes.
 * Separating the concerns prevents the model from randomly guessing
 * coordinates while it is busy reading text.
 */
app.post('/api/ocr', requireAuth, ocrLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { imageData, theme } = req.body as { imageData?: string; theme?: string };
    if (!imageData) {
      res.status(400).json({ error: 'imageData is required' });
      return;
    }

    // ------------------------------------------------------------------
    // Pass 1: text extraction + image type detection + uncertain-word identification (no bboxes)
    // Compact keys: ft=fullText, tp=imageType, uw=uncertainWords, w=word, s=startIndex, e=endIndex, sg=suggestions
    // ------------------------------------------------------------------
    const themeContext = theme ? `\nContexto/temática: ${theme}` : '';
    const pass1Response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        { role: 'system', content: SYSTEM_PT_BR },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é um especialista em OCR. Analise esta imagem e extraia todo o texto visível.${themeContext}

Primeiro, classifique a imagem como:
- "slide": slide/apresentação projetada
- "hw": manuscrito/esboço/anotação à mão
- "print": texto impresso/digitado

Para tipo "slide": transcreva o texto exatamente como aparece, sem interpretar.
Para tipo "hw": interprete holisticamente — leia setas, seções, itens circulados, marcadores de importância, estrutura espacial.${theme ? ` Use o contexto "${theme}" para melhorar a interpretação.` : ''}
Para tipo "print": transcreva fielmente.

Para cada palavra com baixa confiança (caligrafia ruim, baixo contraste, ambiguidade), marque como incerta com até 3 sugestões.

Responda SOMENTE com JSON compacto:
{"ft":"texto completo","tp":"slide|hw|print","uw":[{"w":"palavra","s":<startIndex>,"e":<endIndex>,"sg":["alt1","alt2"]}]}

Regras:
- s/e devem coincidir exatamente com a fatia de ft onde a palavra aparece.
- Se não houver palavras incertas, retorne uw como array vazio.
- Se não houver texto, retorne ft vazio e uw vazio.`,
            },
            { type: 'image_url', image_url: { url: imageData, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
    });

    const pass1Raw = JSON.parse(pass1Response.choices[0].message.content ?? '{}') as {
      ft?: unknown;
      tp?: unknown;
      uw?: Array<{ w?: unknown; s?: unknown; e?: unknown; sg?: unknown }>;
    };

    // Decode compact keys with guardrails
    const fullText: string = typeof pass1Raw.ft === 'string' ? pass1Raw.ft : '';
    const imageType: string = typeof pass1Raw.tp === 'string' ? pass1Raw.tp : 'print';
    const uncertainWords: UncertainWordRaw[] = Array.isArray(pass1Raw.uw)
      ? pass1Raw.uw.map((entry) => ({
          word: typeof entry.w === 'string' ? entry.w : '',
          startIndex: typeof entry.s === 'number' ? entry.s : 0,
          endIndex: typeof entry.e === 'number' ? entry.e : 0,
          suggestions: Array.isArray(entry.sg) ? (entry.sg as string[]) : undefined,
        })).filter((w) => w.word.trim() !== '')
      : [];

    // ------------------------------------------------------------------
    // Pass 2: locate each uncertain word in the image (bboxes only)
    // Compact keys: bx=bboxes, i=index, x=xPercent, y=yPercent, w=widthPercent, h=heightPercent
    // Only performed when there are uncertain words to avoid extra cost.
    // ------------------------------------------------------------------
    if (uncertainWords.length > 0) {
      const wordList = uncertainWords
        .map((w, i) => {
          const contextStart = Math.max(0, w.startIndex - 30);
          const contextEnd = Math.min(fullText.length, w.endIndex + 30);
          const before = fullText.slice(contextStart, w.startIndex);
          const after = fullText.slice(w.endIndex, contextEnd);
          return `${i + 1}. word="${w.word}" context="...${before}[${w.word}]${after}..."`;
        })
        .join('\n');

      const pass2Response = await openai.chat.completions.create({
        model: 'gpt-5.4-nano-2026-03-17',
        messages: [
          { role: 'system', content: SYSTEM_PT_BR },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Mesma imagem do OCR. Localize cada palavra abaixo e retorne seu bounding box como percentagem (0-100) da imagem.

Palavras:
${wordList}

- x,y = canto superior esquerdo; w,h = dimensões da caixa
- Se não encontrar uma palavra, omita-a

Responda SOMENTE com JSON compacto:
{"bx":[{"i":<índice 1-based>,"x":<num>,"y":<num>,"w":<num>,"h":<num>}]}`,
              },
              { type: 'image_url', image_url: { url: imageData, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1024,
      });

      const pass2Raw = JSON.parse(pass2Response.choices[0].message.content ?? '{}') as {
        bx?: Array<{ i?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown }>;
      };

      // Decode compact keys and merge bboxes back into uncertain words (1-based index)
      for (const entry of Array.isArray(pass2Raw.bx) ? pass2Raw.bx : []) {
        const idx = typeof entry.i === 'number' ? entry.i : 0;
        const word = uncertainWords[idx - 1];
        if (
          word &&
          typeof entry.x === 'number' &&
          typeof entry.y === 'number' &&
          typeof entry.w === 'number' &&
          typeof entry.h === 'number'
        ) {
          word.imageBbox = {
            xPercent: entry.x,
            yPercent: entry.y,
            widthPercent: entry.w,
            heightPercent: entry.h,
          };
        }
      }
    }

    res.json({ fullText, uncertainWords, imageType });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

/**
 * POST /api/ocr/batch
 * Requires authentication.
 * Body: { gridData: string, cols: number, rows: number, imageCount: number, theme?: string }
 *   gridData – base64 data-URL of a grid image composed of multiple images.
 *   cols/rows – grid dimensions used to tell the model the layout.
 *   imageCount – exact number of image cells present (≤ cols × rows).
 *
 * Single-pass: the model extracts text from each numbered section in one call.
 * No bounding-box pass is performed for batches; uncertain words still carry
 * suggestions but no visual highlight region.
 *
 * Response: { images: Array<{ fullText, uncertainWords, imageType }> }
 */
app.post('/api/ocr/batch', requireAuth, ocrLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { gridData, cols, rows, imageCount, theme } = req.body as {
      gridData?: string;
      cols?: number;
      rows?: number;
      imageCount?: number;
      theme?: string;
    };

    if (!gridData) {
      res.status(400).json({ error: 'gridData is required' });
      return;
    }
    if (
      typeof cols !== 'number' ||
      typeof rows !== 'number' ||
      typeof imageCount !== 'number' ||
      imageCount < 2 ||
      imageCount > cols * rows
    ) {
      res.status(400).json({ error: 'cols, rows and imageCount (2–cols×rows) are required' });
      return;
    }

    const themeContext = theme ? `\nContexto/temática: ${theme}` : '';
    const sectionNumbers = Array.from({ length: imageCount }, (_, i) => i + 1).join(', ');

    // Scale token budget by image count: each image may need up to 4096 tokens.
    // Cap at 16384 to stay within model limits.
    const batchMaxTokens = Math.min(imageCount * 4096, 16384);

    const batchResponse = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        { role: 'system', content: SYSTEM_PT_BR },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é um especialista em OCR. Esta imagem é uma grade ${cols}×${rows} contendo ${imageCount} seções numeradas (${sectionNumbers}), da esquerda para a direita, de cima para baixo. Cada seção tem seu número no canto superior esquerdo.${themeContext}

Campos JSON: ft=texto completo, tp=tipo de imagem, uw=palavras incertas, w=palavra, s=startIndex, e=endIndex, sg=sugestões.

Para CADA seção, faça:
1. Classifique como "slide", "hw" ou "print".
2. Extraia todo o texto visível.
   - "slide": transcreva exatamente como aparece.
   - "hw": interprete holisticamente — setas, seções, estrutura espacial.${theme ? ` Use o contexto "${theme}".` : ''}
   - "print": transcreva fielmente.
3. Marque palavras incertas com até 3 sugestões.

Regras:
- s/e devem coincidir exatamente com a fatia de ft onde a palavra aparece, por seção.
- Se não houver palavras incertas, retorne uw como array vazio.
- Se uma seção não tiver texto, retorne ft vazio e uw vazio.
- Responda SOMENTE com JSON compacto, sem markdown:
{"sections":[{"n":1,"ft":"texto","tp":"slide|hw|print","uw":[{"w":"palavra","s":<start>,"e":<end>,"sg":["alt1"]}]},…]}`,
            },
            { type: 'image_url', image_url: { url: gridData, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: batchMaxTokens,
    });

    if (!batchResponse.choices.length) {
      res.status(500).json({ error: 'No response from OCR model' });
      return;
    }

    const finishReason = batchResponse.choices[0].finish_reason;
    if (finishReason === 'length') {
      res.status(422).json({ error: 'OCR batch response was truncated due to token limit. Try reducing the number of images per batch.' });
      return;
    }

    const batchRaw = JSON.parse(batchResponse.choices[0].message.content ?? '{}') as {
      sections?: Array<{
        n?: unknown;
        ft?: unknown;
        tp?: unknown;
        uw?: Array<{ w?: unknown; s?: unknown; e?: unknown; sg?: unknown }>;
      }>;
    };

    const sections = Array.isArray(batchRaw.sections) ? batchRaw.sections : [];

    // Build one OcrResult per image cell (sections are 1-based)
    const images = Array.from({ length: imageCount }, (_, idx) => {
      const section = sections.find((s) => s.n === idx + 1) ?? {};
      const fullText: string = typeof section.ft === 'string' ? section.ft : '';
      const imageType: string = typeof section.tp === 'string' ? section.tp : 'print';
      const uncertainWords: UncertainWordRaw[] = Array.isArray(section.uw)
        ? section.uw
            .map((entry) => ({
              word: typeof entry.w === 'string' ? entry.w : '',
              startIndex: typeof entry.s === 'number' ? entry.s : 0,
              endIndex: typeof entry.e === 'number' ? entry.e : 0,
              suggestions: Array.isArray(entry.sg) ? (entry.sg as string[]) : undefined,
            }))
            .filter((w) => w.word.trim() !== '')
        : [];
      return { fullText, uncertainWords, imageType };
    });

    res.json({ images });
  } catch (error) {
    console.error('OCR batch error:', error);
    res.status(500).json({ error: 'Failed to process image batch' });
  }
});

const NOTE_TYPE_INSTRUCTIONS: Record<string, string> = {
  'mapa-mental': `Formate como um mapa mental em Markdown:
- Use títulos (##) para os nós principais
- Use listas aninhadas para sub-nós
- Agrupe conceitos relacionados
- Destaque conexões importantes em negrito`,
  'insights-corporativos': `Formate como insights corporativos em Markdown:
- Identifique e destaque os principais aprendizados
- Use seções claras: Contexto, Insights, Ações Recomendadas
- Use bullet points concisos
- Destaque métricas ou dados relevantes em negrito`,
  'anotacoes': `Formate como anotações estruturadas em Markdown:
- Organize por tópicos com subtítulos
- Mantenha fidelidade ao conteúdo original
- Use listas para enumerações
- Preserve a estrutura lógica do texto`,
  'ideias': `Formate como registro de ideias em Markdown:
- Destaque a ideia central em primeiro lugar
- Use bullet points para desdobramentos
- Adicione seções de "Possibilidades" e "Próximos Passos"
- Encoraje conexões criativas`,
};

const DEFAULT_NOTE_INSTRUCTION = NOTE_TYPE_INSTRUCTIONS['anotacoes'];

/**
 * POST /api/structure
 * Requires authentication.
 * Body: { text: string, noteType?: string, existingNote?: { title: string, content: string }, theme?: string }
 * Response: { title: string, content: string }
 */
app.post('/api/structure', requireAuth, structureLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { text, noteType, existingNote, config, theme } = req.body as {
      text?: string;
      noteType?: string;
      existingNote?: { title: string; content: string };
      theme?: string;
      config?: {
        detailLevel?: 'resumido' | 'normal' | 'detalhado';
        tone?: 'formal' | 'neutro' | 'casual';
        includeExamples?: boolean;
      };
    };
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const typeInstruction =
      (noteType && NOTE_TYPE_INSTRUCTIONS[noteType]) || DEFAULT_NOTE_INSTRUCTION;

    const detailInstructions: Record<string, string> = {
      resumido: 'Seja conciso: escreva a nota de forma breve, destacando apenas os pontos essenciais.',
      normal: 'Use um nível de detalhe equilibrado, cobrindo os pontos principais sem ser excessivo.',
      detalhado:
        'Seja abrangente: desenvolva cada ponto com profundidade, incluindo contexto e nuances importantes.',
    };

    const toneInstructions: Record<string, string> = {
      formal:
        'Use linguagem formal e profissional, evitando gírias ou expressões coloquiais.',
      neutro: 'Use linguagem neutra e objetiva.',
      casual:
        'Use linguagem casual e acessível, com um tom descontraído e próximo do leitor.',
    };

    const detailInstruction = detailInstructions[config?.detailLevel ?? 'normal'];
    const toneInstruction = toneInstructions[config?.tone ?? 'neutro'];
    const examplesInstruction = config?.includeExamples
      ? 'Quando relevante, adicione exemplos práticos para ilustrar os conceitos.'
      : 'Não adicione exemplos; mantenha o foco no conteúdo principal.';
    const themeContext = theme ? `\nTemática/contexto: ${theme}` : '';

    let prompt: string;

    if (existingNote) {
      prompt = `Você é um especialista em organização de notas. Atualize a nota existente incorporando o novo conteúdo.${themeContext}

NOTA EXISTENTE:
Título: ${existingNote.title}
Conteúdo:
${existingNote.content}

NOVO CONTEÚDO:
${text}

INSTRUÇÕES:
1. Mescle o novo conteúdo de forma coesa, eliminando redundâncias
2. Corrija erros gramaticais e ortográficos
3. ${typeInstruction}
4. ${detailInstruction}
5. ${toneInstruction}
6. ${examplesInstruction}
7. Título conciso e descritivo (máx. 60 caracteres)

Retorne SOMENTE JSON compacto: {"t":"título","c":"conteúdo markdown"}`;
    } else {
      prompt = `Você é um especialista em formatação de notas. Transforme o texto em uma nota organizada.${themeContext}

1. Corrija erros gramaticais e ortográficos
2. Formate em Markdown adequado
3. ${typeInstruction}
4. ${detailInstruction}
5. ${toneInstruction}
6. ${examplesInstruction}
7. Título conciso e descritivo (máx. 60 caracteres)

Retorne SOMENTE JSON compacto: {"t":"título","c":"conteúdo markdown"}

Texto: ${text}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        { role: 'system', content: SYSTEM_PT_BR },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
    });

    const raw = JSON.parse(response.choices[0].message.content ?? '{}') as {
      t?: unknown;
      c?: unknown;
      title?: unknown;
      content?: unknown;
    };
    const title = typeof raw.t === 'string' ? raw.t : (typeof raw.title === 'string' ? raw.title : '');
    const content = typeof raw.c === 'string' ? raw.c : (typeof raw.content === 'string' ? raw.content : '');
    res.json({ title, content });
  } catch (error) {
    console.error('Structure error:', error);
    res.status(500).json({ error: 'Failed to structure note' });
  }
});

/**
 * POST /api/generate
 * Requires authentication.
 * Body: { notes: Array<{title, content}>, prompt: string, noteType?: string, config?: NoteConfigApi }
 * Response: { title: string, content: string }
 */
app.post('/api/generate', requireAuth, structureLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { notes: inputNotes, prompt, noteType, config } = req.body as {
      notes?: Array<{ title: string; content: string }>;
      prompt?: string;
      noteType?: string;
      config?: {
        detailLevel?: 'resumido' | 'normal' | 'detalhado';
        tone?: 'formal' | 'neutro' | 'casual';
        includeExamples?: boolean;
      };
    };

    if (!prompt || !Array.isArray(inputNotes) || inputNotes.length === 0) {
      res.status(400).json({ error: 'notes e prompt são obrigatórios' });
      return;
    }

    const typeInstruction =
      (noteType && NOTE_TYPE_INSTRUCTIONS[noteType]) || DEFAULT_NOTE_INSTRUCTION;

    const notesContext = inputNotes
      .map((n, i) => `### Nota ${i + 1}: ${n.title}\n${n.content}`)
      .join('\n\n---\n\n');

    const detailInstructions: Record<string, string> = {
      resumido: 'Seja conciso, apenas pontos essenciais.',
      normal: 'Nível de detalhe equilibrado.',
      detalhado: 'Seja abrangente e aprofundado.',
    };
    const toneInstructions: Record<string, string> = {
      formal: 'Linguagem formal e profissional.',
      neutro: 'Linguagem neutra e objetiva.',
      casual: 'Linguagem casual e acessível.',
    };

    const detailInstruction = detailInstructions[config?.detailLevel ?? 'normal'];
    const toneInstruction = toneInstructions[config?.tone ?? 'neutro'];

    const aiPrompt = `Com base nas notas fornecidas, crie uma nova nota seguindo a instrução do usuário.

NOTAS DE REFERÊNCIA:
${notesContext}

INSTRUÇÃO DO USUÁRIO: ${prompt}

FORMATO: ${typeInstruction}
DETALHE: ${detailInstruction}
TOM: ${toneInstruction}
${config?.includeExamples ? 'Inclua exemplos práticos.' : ''}

Retorne SOMENTE JSON compacto: {"t":"título","c":"conteúdo markdown"}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        { role: 'system', content: SYSTEM_PT_BR },
        { role: 'user', content: aiPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
    });

    const raw = JSON.parse(response.choices[0].message.content ?? '{}') as {
      t?: unknown;
      c?: unknown;
      title?: unknown;
      content?: unknown;
    };
    const title = typeof raw.t === 'string' ? raw.t : (typeof raw.title === 'string' ? raw.title : 'Nova nota');
    const content = typeof raw.c === 'string' ? raw.c : (typeof raw.content === 'string' ? raw.content : '');
    res.json({ title, content });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate note' });
  }
});

/**
 * POST /api/slides
 * Requires authentication.
 * Body: { prompt: string, context: string, config?: NoteConfigApi, notesContext?: string }
 * Response: { title: string, content: string }
 */
app.post('/api/slides', requireAuth, structureLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, context, config, notesContext } = req.body as {
      prompt?: string;
      context?: string;
      notesContext?: string;
      config?: {
        detailLevel?: 'resumido' | 'normal' | 'detalhado';
        tone?: 'formal' | 'neutro' | 'casual';
        includeExamples?: boolean;
      };
    };

    if (!context) {
      res.status(400).json({ error: 'context é obrigatório' });
      return;
    }

    const detailInstructions: Record<string, string> = {
      resumido: '3-4 slides concisos.',
      normal: '5-7 slides equilibrados.',
      detalhado: '8-12 slides detalhados.',
    };
    const detailInstruction = detailInstructions[config?.detailLevel ?? 'normal'];

    const notesSection = notesContext
      ? `\n\nNOTAS DE REFERÊNCIA:\n${notesContext}\n\nUse essas notas como base para o conteúdo dos slides.`
      : '';

    const aiPrompt = `Crie uma estrutura de slides para uma apresentação.

CONTEXTO DA APRESENTAÇÃO: ${context}${notesSection}${prompt ? `\nINSTRUÇÕES ADICIONAIS: ${prompt}` : ''}
QUANTIDADE: ${detailInstruction}

Cada slide deve ter título (heading), conteúdo (bullets ou texto) e notas do apresentador.

Retorne SOMENTE JSON compacto:
{"t":"título da apresentação","sl":[{"h":"título do slide","b":"conteúdo/bullets","n":"notas do apresentador"}]}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        { role: 'system', content: SYSTEM_PT_BR },
        { role: 'user', content: aiPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
    });

    const raw = JSON.parse(response.choices[0].message.content ?? '{}') as {
      t?: unknown;
      sl?: Array<{ h?: unknown; b?: unknown; n?: unknown }>;
      title?: unknown;
    };

    const presentationTitle = typeof raw.t === 'string' ? raw.t : (typeof raw.title === 'string' ? raw.title : 'Apresentação');
    const slides = Array.isArray(raw.sl) ? raw.sl : [];

    const markdownContent = slides
      .map((slide) => {
        const heading = typeof slide.h === 'string' ? slide.h : '';
        const body = typeof slide.b === 'string' ? slide.b : '';
        const notes = typeof slide.n === 'string' ? slide.n : '';
        let md = `## ${heading}\n\n${body}`;
        if (notes) md += `\n\n> ${notes}`;
        return md;
      })
      .join('\n\n---\n\n');

    res.json({ title: presentationTitle, content: `# ${presentationTitle}\n\n${markdownContent}` });
  } catch (error) {
    console.error('Slides error:', error);
    res.status(500).json({ error: 'Failed to generate slides' });
  }
});

// ---------------------------------------------------------------------------
// Notes CRUD routes
// ---------------------------------------------------------------------------

/**
 * GET /api/notes
 * Requires authentication.
 * Response: Note[]
 */
app.get('/api/notes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notes = await getNotesByUser(req.user!.sub);
    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

/**
 * POST /api/notes
 * Requires authentication.
 * Body: { id, title, content, noteType?, originalImage?, originalImages?, createdAt, updatedAt }
 * Response: Note
 */
app.post('/api/notes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, content, noteType, originalImage, originalImages, createdAt, updatedAt } =
      req.body as {
        id?: string;
        title?: string;
        content?: string;
        noteType?: string;
        originalImage?: string;
        originalImages?: string[];
        createdAt?: number;
        updatedAt?: number;
      };

    if (!id || !title || content === undefined) {
      res.status(400).json({ error: 'id, title e content são obrigatórios.' });
      return;
    }

    const now = Date.now();
    const note = await createNote({
      id,
      userId: req.user!.sub,
      title,
      content,
      noteType,
      originalImage,
      originalImages,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
    });
    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

/**
 * PUT /api/notes/:id
 * Requires authentication.
 * Body: Partial<{ title, content, noteType, originalImage, originalImages }>
 * Response: Note
 */
app.put('/api/notes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { title, content, noteType, originalImage, originalImages } = req.body as {
      title?: string;
      content?: string;
      noteType?: string;
      originalImage?: string;
      originalImages?: string[];
    };

    const note = await updateNote(id, req.user!.sub, {
      title,
      content,
      noteType,
      originalImage,
      originalImages,
    });

    if (!note) {
      res.status(404).json({ error: 'Nota não encontrada.' });
      return;
    }
    res.json(note);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

/**
 * DELETE /api/notes/:id
 * Requires authentication.
 * Response: 204 No Content
 */
app.delete('/api/notes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const deleted = await deleteNote(id, req.user!.sub);
    if (!deleted) {
      res.status(404).json({ error: 'Nota não encontrada.' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  WARNING: OPENAI_API_KEY is not set – requests will fail');
      }
      // JWT_SECRET warnings are handled in auth.ts at module load time
    });
  })
  .catch((err) => {
    console.error('FATAL: Failed to initialize database:', err);
    process.exit(1);
  });
