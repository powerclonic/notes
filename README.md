# NoteSnap 📸✨

NoteSnap é uma aplicação web que transforma imagens de anotações manuscritas ou slides em notas digitais estruturadas, utilizando IA (GPT-4o) para reconhecimento de texto com revisão humana.

## Funcionalidades

- **Captura flexível** – tire fotos diretamente pela câmera ou faça upload de imagens existentes.
- **OCR com IA** – extrai texto de anotações manuscritas, slides e qualquer imagem com texto.
- **Revisão inteligente** – palavras com baixa confiança são destacadas para revisão. O diálogo de correção mostra o **recorte da imagem original** no local exato da palavra, dando contexto visual ao usuário.
- **Estruturação automática** – organiza o texto extraído em notas formatadas em Markdown com títulos, listas e hierarquia.
- **Tipos de nota** – Anotações, Mapa Mental, Insights Corporativos e Ideias, cada um com instruções de formatação específicas.
- **Configuração de saída** – escolha o nível de detalhe (resumido/normal/detalhado), o tom de escrita (formal/neutro/casual) e se deseja exemplos práticos.
- **Atualização de notas** – incorpore novo conteúdo a uma nota já existente.
- **Biblioteca de notas** – visualize, edite, pesquise e exclua notas salvas.
- **Autenticação segura** – cadastro e login com email/senha. Senhas armazenadas com bcrypt (cost 12). Sessão via JWT (7 dias).
- **Rate limiting** – proteção contra abuso nas APIs de OCR, estruturação e autenticação.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilização | Tailwind CSS v4 + Radix UI + shadcn/ui |
| Ícones | Phosphor Icons |
| Animações | Framer Motion |
| Backend | Node.js + Express + TypeScript |
| IA | OpenAI GPT-4o (Vision + Chat) |
| Auth | bcryptjs + jsonwebtoken |
| Rate Limiting | express-rate-limit |

## Pré-requisitos

- Node.js 20+
- Chave de API da OpenAI com acesso ao modelo `gpt-4o`

## Instalação e uso local

```bash
# 1. Clone o repositório
git clone https://github.com/powerclonic/notes.git
cd notes

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env e preencha OPENAI_API_KEY e JWT_SECRET

# 4. Inicie frontend + backend juntos
npm run dev:all
```

Acesse http://localhost:5173.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | Sim | Chave de API da OpenAI |
| `JWT_SECRET` | Sim em produção | Segredo para assinar tokens JWT |
| `PORT` | Não | Porta do backend (padrão: `3001`) |
| `USERS_DB_PATH` | Não | Caminho do arquivo JSON de usuários (padrão: `./data/users.json`) |

## Deploy com Docker

```bash
# Backend
docker build -f Dockerfile -t notesnap-api .
docker run -e OPENAI_API_KEY=sk-... -e JWT_SECRET=supersecret -p 3001:3001 notesnap-api

# Frontend
docker build -f Dockerfile.frontend -t notesnap-web .
docker run -p 80:80 notesnap-web
```

## API

Todos os endpoints (exceto `/api/health`, `/api/auth/register` e `/api/auth/login`) exigem o header `Authorization: Bearer <token>`.

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Status da API |
| `POST` | `/api/auth/register` | Cadastro de usuário |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Dados do usuário logado |
| `POST` | `/api/ocr` | Extração de texto de imagem |
| `POST` | `/api/structure` | Estruturação de nota |

### Rate limits

| Endpoint | Limite |
|---|---|
| Global | 120 req / 15 min por IP |
| `/api/auth/*` | 10 req / 15 min por IP |
| `/api/ocr` | 30 req / hora por IP |
| `/api/structure` | 60 req / hora por IP |

## Licença

MIT
