# DocuMind AI

DocuMind AI is a document Q&A web app built with Next.js. Upload a document, ask questions about its contents, review the passages used to answer, and generate summaries.

> **Project status:** This is a demo/learning project, not a production-ready SaaS. Authentication and demo storage are in-memory, user passwords are not stored in a production-grade identity system, API routes do not implement per-user document authorization, and PostgreSQL data is shared across users. Do not deploy it with real user data without adding proper authentication, authorization, privacy controls, and operational safeguards.

## What it does

- Upload PDF, DOCX, TXT, PNG, JPG, and WebP files through the dashboard or workspace.
- Validate file size (15 MB per file), file type, and extracted content on the server. A request can contain up to five files.
- Extract selectable PDF text page-by-page, preserve layout/table columns and headings, and OCR scanned PDF pages and image uploads.
- Split page-specific text into overlapping chunks and keep the actual PDF page number with each citation.
- Ask questions across up to five selected documents, then inspect the exact retrieved passage, page, source document, and evidence-match status beside every answer.
- Stream answers as Server-Sent Events (SSE), including source metadata. Follow-up questions can use saved conversation history.
- Generate short/detailed summaries, key points, definitions, findings, conclusions, action items, or flashcards; export answers and summaries to Markdown.
- Review a small synthetic contract benchmark with answer-evidence support, citation precision, and retrieval recall metrics.
- Review retention and provider disclosure in Settings, and delete all stored documents and their derived content/conversations from the app.
- Manage documents and conversations from the dashboard and workspace. Delete operations remove related records.
- Run with an in-memory demo store when no database URL is configured, or use PostgreSQL through Drizzle ORM.

## Screens

- **Landing page (`/`)** — overview of the app and its workflow.
- **Dashboard (`/dashboard`)** — upload documents, view status and storage statistics, search, open, and delete documents.
- **Workspace (`/workspace`)** — select a document, chat, inspect source passages, and create summaries.
- **Settings (`/settings`)** — inspect service status, choose the saved theme preference, and clear documents.
- **Login and registration (`/login`, `/register`)** — demo-only in-memory account forms.

## Technology

| Area | Technologies |
|---|---|
| Web app | Next.js 16 App Router, React 19, TypeScript |
| Styling and icons | Tailwind CSS 4, Lucide React |
| Data access | Drizzle ORM, PostgreSQL, `pg` |
| Document extraction | PDF.js, `@napi-rs/canvas`, `mammoth`, Tesseract.js |
| AI | Google Gemini REST API; contextual demo responder when no API key is configured |
| Tests and lint | Vitest, ESLint, TypeScript |

## Architecture and data flow

### Upload and indexing

1. The browser sends multipart form data to `POST /api/documents/upload`.
2. The server validates file count, extension, size, and content, then extracts PDF, DOCX, TXT, or supported image text.
3. PDF.js extracts text and text positions per page; columns are kept distinct and headings are inferred from layout. Scanned pages are rendered locally with `@napi-rs/canvas` and recognized with Tesseract.js. OCR runs on the app server; Tesseract.js may download the English model on first use and caches it outside the project in the OS temporary directory.
4. Text is cleaned and split into chunks (900-character target size with 150-character overlap) without losing the source page number.
5. The document and its chunks are saved. The document is marked `completed` after indexing succeeds.
6. The dashboard reads document metadata from `GET /api/documents`.

### Questions and answers

1. The workspace sends a question and up to five selected document IDs to `POST /api/documents/[id]/ask`.
2. The server retrieves up to five relevant chunks across those documents, includes conversation history, and starts an SSE response.
3. SSE metadata includes exact passages, source document names, actual PDF pages, and a lexical evidence-match status (strong/partial/limited). This status is a heuristic, not a calibrated probability.
4. User and assistant messages are stored with the full source references. With a Gemini key, the question and retrieved passages are sent to Google Gemini; without one, a contextual demo responder runs in the app server.

### Summaries

`POST /api/documents/[id]/summarize` gathers the document chunks and generates the requested summary format. The Gemini request context is limited to 12,000 characters; this is truncation, not hierarchical summarization.

### Storage

PostgreSQL mode uses the schema in `src/db/schema.ts`. Without `DATABASE_URL`, the app uses an in-memory store that supports the operations used by the app, including document/conversation cascades. Demo data is lost when the Node.js server process restarts. The demo store is not isolated by account.

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health and configured database/AI mode |
| `GET` | `/api/auth/login` | Check whether the request has a valid signed demo session |
| `POST` | `/api/auth/login` | Sign in to an in-memory account |
| `POST` | `/api/auth/register` | Create an in-memory demo account |
| `GET` | `/api/documents` | List documents |
| `POST` | `/api/documents/upload` | Validate, extract, chunk, and save up to five files |
| `GET`, `DELETE` | `/api/documents/[id]` | Read a document and its chunks, or delete it |
| `POST` | `/api/documents/[id]/ask` | Ask a question across up to five document IDs and receive SSE answer/evidence metadata |
| `POST` | `/api/documents/[id]/summarize` | Generate a summary, action items, or flashcards |
| `GET`, `POST` | `/api/conversations` | List or create conversations |
| `GET`, `DELETE` | `/api/conversations/[id]` | Read or delete a conversation and its messages |
| `POST` | `/api/chat/clear` | Clear messages in a conversation |

## Database schema

The Drizzle schema defines four PostgreSQL tables:

- **`documents`** — file name/type/size, processing status, page and chunk counts, text length, preview, timestamps.
- **`chunks`** — ordered extracted text segments, optional heading, actual source page where available, and token count. References `documents` with cascade delete.
- **`conversations`** — document reference, title, and timestamps. References `documents` with cascade delete.
- **`messages`** — user/assistant role, message text, optional JSON source references, and timestamp. References `conversations` with cascade delete.

## Project structure

```text
.
├── .env.example                 # Safe environment-variable template
├── .gitignore                  # Local secrets and generated files excluded from Git
├── evaluation
│   ├── dataset.json            # Small synthetic retrieval/citation evaluation set
│   └── results.json            # Latest reported metrics and methodology/limitations
├── drizzle.config.json         # Drizzle Kit configuration (legacy/static)
├── drizzle.config.ts           # Environment-based Drizzle Kit configuration
├── eslint.config.mjs
├── middleware.ts               # Page protection and response security headers
├── next.config.ts
├── package.json                # Scripts and dependencies
├── package-lock.json
├── postcss.config.mjs
├── README.md
├── tsconfig.json
├── vitest.config.ts
└── src
    ├── app
    │   ├── api
    │   │   ├── auth
    │   │   │   ├── login/route.ts
    │   │   │   └── register/route.ts
    │   │   ├── chat/clear/route.ts
    │   │   ├── conversations
    │   │   │   ├── [id]/route.ts
    │   │   │   └── route.ts
    │   │   ├── documents
    │   │   │   ├── [id]
    │   │   │   │   ├── ask/route.test.ts # Multi-document citation route test
    │   │   │   │   ├── ask/route.ts
    │   │   │   │   ├── summarize/route.ts
    │   │   │   │   └── route.ts
    │   │   │   ├── upload/route.ts
    │   │   │   └── route.ts
    │   │   └── health/route.ts
    │   ├── dashboard/page.tsx
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── settings/page.tsx
    │   ├── workspace/page.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components
    │   ├── Navigation.tsx       # Top navigation, sidebar, and mobile navigation
    │   ├── UploadZone.tsx       # File picker, drag/drop, and upload feedback
    │   └── ui.tsx               # Shared cards, buttons, badges, and spinner
    ├── db
    │   ├── __tests__/index.test.ts
    │   ├── index.ts             # PostgreSQL connection and in-memory demo adapter
    │   └── schema.ts            # Drizzle tables and relationships
    └── lib
        ├── __tests__
        │   ├── evaluation.test.ts
        │   └── retrieval.test.ts
        ├── ai/provider.ts       # Gemini streaming and local demo responses
        ├── auth.ts              # Signed demo session cookie helpers
        ├── document-processing.ts # Validation, extraction, cleanup, chunking
        ├── ocr.ts               # Image OCR
        ├── retrieval.ts         # Passage scoring and source formatting
        ├── security.ts          # Input helpers, rate limits, response headers
        └── user-store.ts        # In-memory demo user store
```

## Requirements

- Node.js compatible with Next.js 16 (Node.js 20.9 or later recommended)
- npm
- Optional: a PostgreSQL database
- Optional: a Google Gemini API key

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
# Edit .env.local if you want PostgreSQL or Gemini.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a demo account at `/register`; accounts exist only in the running process.

For PostgreSQL, set `DATABASE_URL` in `.env.local`, then apply the schema:

```bash
npx drizzle-kit push
```

To use Gemini, set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env.local` and restart the server. If it is unset, question answering and summaries use the local demo responder.

### Environment variables

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | No | PostgreSQL connection string. Omit for non-persistent in-memory demo mode. |
| `GEMINI_API_KEY` | No | Google Gemini API key for generated answers and summaries. |
| `GOOGLE_API_KEY` | No | Alternative Gemini API key variable. |
| `COOKIE_SECRET` | No for local demo | Session-cookie signing secret. Set a long, random value anywhere the app is deployed. |

Never commit `.env.local` or real credentials. `.env.example` contains placeholders only.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the built app |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm test` | Run Vitest |
| `npm run evaluate` | Run the published synthetic retrieval benchmark |
| `npm run check:deploy` | Check that `DATABASE_URL` is configured |

## Testing

The tests cover retrieval ranking, PDF layout/page extraction, OCR citation labeling, file validation, chunk-size behavior, the in-memory database, and a synthetic contract benchmark.

The current benchmark results are in [`evaluation/results.json`](./evaluation/results.json). The four synthetic cases score **100% answer-evidence support**, **71.4% citation precision**, and **100% retrieval recall@5**. Answer-evidence support means each case's expected fact appears in retrieved text; it is not a measurement of generated Gemini answer accuracy or human judgment.

```bash
npm test
npm run evaluate
npm run typecheck
npm run lint
npm run build
```

## Security and production limitations

- The login/register implementation and user store are demo-only and in-memory. Use a proper identity provider and password hashing before deployment.
- The API currently does not enforce per-user document ownership. Documents and conversations are shared by the demo backend.
- Without PostgreSQL, all application data is lost when the server restarts.
- Configure a strong `COOKIE_SECRET` for deployments; never rely on a local fallback.
- File parsing and AI calls consume server resources. Add deployment-appropriate request limits, timeouts, monitoring, and abuse protection.
- Do not upload sensitive or confidential documents to an unreviewed deployment.
- Retrieval is local keyword/cosine scoring, not embedding-based semantic search. The displayed evidence status uses query-term overlap and is not a calibrated confidence score.
- OCR quality depends on scan clarity, rotation, language (English), and server resources. Tables are represented as layout-preserving text, not structured spreadsheet data.
- Data remains stored until manually deleted. The Settings clear-all action removes documents and related content; PostgreSQL deletion is persistent, while in-memory demo data also disappears on server restart.
- The app has shared storage and no per-user document authorization. Do not deploy it with sensitive documents without implementing authentication, access isolation, and appropriate retention controls.
- When Gemini is configured, retrieved passages and questions are transmitted to Google's API; use the local demo responder if external processing is not appropriate.
- The saved dark/system theme preferences do not currently switch the complete application theme.

## Deployment notes

The project can be deployed to a Node.js host or Vercel after configuring `DATABASE_URL`, `COOKIE_SECRET`, and optionally `GEMINI_API_KEY`. Before production, implement persistent accounts and per-user authorization, verify file-upload limits for the chosen host, and review the security limitations above. `npm run check:deploy` only checks for the database URL; it is not a full production-readiness or security check.

## License

No license is currently included. Unless a license is added, standard copyright restrictions apply.
