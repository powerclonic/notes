import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { signToken, requireAuth, AuthRequest } from './auth.js';
import { findByEmail, findById, createUser } from './users.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

const SYSTEM_PT_BR =
  'Você é um assistente especializado. Responda SEMPRE em português brasileiro (pt-BR), sem exceções.';

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

    if (findByEmail(email)) {
      res.status(409).json({ error: 'Email já cadastrado.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = createUser(uuidv4(), email, passwordHash);
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

    const user = findByEmail(email);
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
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = findById(req.user!.sub);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }
  res.json({ id: user.id, email: user.email });
});

/**
 * POST /api/ocr
 * Requires authentication.
 * Body: { imageData: string }  – base64 data-URL (e.g. data:image/jpeg;base64,...)
 * Response: { fullText: string, uncertainWords: UncertainWord[] }
 */
app.post('/api/ocr', requireAuth, ocrLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { imageData } = req.body as { imageData?: string };
    if (!imageData) {
      res.status(400).json({ error: 'imageData is required' });
      return;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PT_BR,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an OCR expert specialized in reading handwritten notes and slide images.

Analyze this image and extract ALL text visible in it. This could be handwritten notes, typed text on slides, or any other text.

For each word you are uncertain about (due to poor handwriting, image quality, etc.), mark it as uncertain and include its approximate position in the image as percentage coordinates so the user can find it visually.

Return your response as a JSON object with this exact structure:
{
  "fullText": "the complete extracted text with all words in order",
  "uncertainWords": [
    {
      "word": "the word you're uncertain about (as you read it from the image)",
      "startIndex": <number: character position where word starts in fullText>,
      "endIndex": <number: character position where word ends in fullText>,
      "suggestions": ["alternative1", "alternative2"],
      "imageBbox": {
        "xPercent": <number 0-100: left edge of the word in the image>,
        "yPercent": <number 0-100: top edge of the word in the image>,
        "widthPercent": <number 0-100: width of the word bounding box>,
        "heightPercent": <number 0-100: height of the word bounding box>
      }
    }
  ]
}

Important guidelines:
- Extract ALL text you can see, maintaining original structure (paragraphs, bullet points, etc.)
- Be honest about uncertainty – mark words you're not confident about
- For handwritten text, be more cautious about certainty
- Include proper line breaks to maintain text structure
- Provide bounding boxes as percentages relative to full image dimensions (0-100). Add a small margin around the word so the user can see it clearly in context
- If you see no text, return empty fullText and empty uncertainWords array`,
            },
            {
              type: 'image_url',
              image_url: { url: imageData, detail: 'high' },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    });

    const result = JSON.parse(response.choices[0].message.content ?? '{}');
    res.json(result);
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Failed to process image' });
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
 * Body: { text: string, noteType?: string, existingNote?: { title: string, content: string } }
 * Response: { title: string, content: string }
 */
app.post('/api/structure', requireAuth, structureLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { text, noteType, existingNote, config } = req.body as {
      text?: string;
      noteType?: string;
      existingNote?: { title: string; content: string };
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

    let prompt: string;

    if (existingNote) {
      prompt = `Você é um especialista em organização de notas. Sua tarefa é ATUALIZAR uma nota existente incorporando novo conteúdo extraído.

NOTA EXISTENTE:
Título: ${existingNote.title}
Conteúdo:
${existingNote.content}

NOVO CONTEÚDO EXTRAÍDO:
${text}

INSTRUÇÕES:
1. Mescle o novo conteúdo com a nota existente de forma coesa
2. Elimine redundâncias, mantendo informações únicas de ambos
3. Corrija erros gramaticais e ortográficos
4. ${typeInstruction}
5. ${detailInstruction}
6. ${toneInstruction}
7. ${examplesInstruction}
8. Gere um título conciso e descritivo (máximo 60 caracteres)
9. Responda SEMPRE em português brasileiro

Retorne como JSON:
{
  "title": "Título conciso para a nota",
  "content": "Conteúdo formatado e estruturado em Markdown com quebras de linha adequadas"
}`;
    } else {
      prompt = `Você é um especialista em formatação de notas. Transforme o texto extraído em uma nota limpa e bem organizada.

Suas tarefas:
1. Corrija erros gramaticais e ortográficos óbvios
2. Adicione formatação adequada em Markdown (títulos, listas, negrito onde relevante)
3. Organize o conteúdo em seções lógicas
4. ${typeInstruction}
5. ${detailInstruction}
6. ${toneInstruction}
7. ${examplesInstruction}
8. Gere um título conciso e descritivo (máximo 60 caracteres)
9. Responda SEMPRE em português brasileiro

Retorne como JSON:
{
  "title": "Título conciso para a nota",
  "content": "Conteúdo formatado e estruturado em Markdown com quebras de linha adequadas"
}

Texto a estruturar: ${text}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano-2026-03-17',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PT_BR,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    });

    const result = JSON.parse(response.choices[0].message.content ?? '{}');
    res.json(result);
  } catch (error) {
    console.error('Structure error:', error);
    res.status(500).json({ error: 'Failed to structure note' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY is not set – requests will fail');
  }
  // JWT_SECRET warnings are handled in auth.ts at module load time
});
