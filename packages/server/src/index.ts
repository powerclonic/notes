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
    ],
  })
);
app.use(express.json({ limit: '50mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

/**
 * POST /api/structure
 * Format raw text into a clean, well-organized note using gpt-4o.
 * Body: { text: string }
 * Response: { title: string, content: string }
 */
app.post('/api/structure', async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `You are a note formatting expert. Take this extracted text and structure it into a clean, well-formatted note.

Your tasks:
1. Fix any obvious spelling/grammar errors
2. Add proper formatting (headings, bullet points, numbered lists where appropriate)
3. Organize content into logical sections
4. Generate a concise, descriptive title (max 60 characters)

Return as JSON:
{
  "title": "A concise title for the note",
  "content": "The formatted and structured content with proper line breaks and organization"
}

Text to structure: ${text}`,
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
