import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 3001;

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

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * POST /api/ocr
 * Extract text from an image using OpenAI Vision (gpt-4o).
 * Body: { imageData: string }  – base64 data-URL (e.g. data:image/jpeg;base64,...)
 * Response: { fullText: string, uncertainWords: UncertainWord[] }
 */
app.post('/api/ocr', async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body as { imageData?: string };
    if (!imageData) {
      res.status(400).json({ error: 'imageData is required' });
      return;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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

For each word you extract, if you're uncertain about its accuracy (due to poor handwriting, image quality, etc.), mark it as uncertain.

Return your response as a JSON object with this exact structure:
{
  "fullText": "the complete extracted text with all words in order",
  "uncertainWords": [
    {
      "word": "the word you're uncertain about",
      "startIndex": <number: character position where word starts in fullText>,
      "endIndex": <number: character position where word ends in fullText>,
      "suggestions": ["alternative1", "alternative2"]
    }
  ]
}

Important guidelines:
- Extract ALL text you can see, maintaining original structure (paragraphs, bullet points, etc.)
- Be honest about uncertainty – mark words you're not confident about
- For handwritten text, be more cautious about certainty
- Include proper line breaks to maintain text structure
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
 * Format raw text into a clean, well-organized note using gpt-4o.
 * Body: { text: string, noteType?: string, existingNote?: { title: string, content: string } }
 * Response: { title: string, content: string }
 */
app.post('/api/structure', async (req: Request, res: Response) => {
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

    const detailInstruction =
      detailInstructions[config?.detailLevel ?? 'normal'] ?? detailInstructions['normal'];
    const toneInstruction =
      toneInstructions[config?.tone ?? 'neutro'] ?? toneInstructions['neutro'];
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
      model: 'gpt-4o',
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
});
