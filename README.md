# URL Shortener (HTML Email Parser)

Full-stack TypeScript app that shortens URLs in uploaded HTML email files. It parses links in the HTML, stores originals in a database, generates short redirect URLs, and returns the modified HTML for download or preview.

## Highlights
- Frontend: React + TypeScript (Vite), TailwindCSS
- Backend: Express + TypeScript, Prisma ORM (SQLite by default)
- Parsing: Cheerio
- Short IDs: nanoid (with retry on unique constraint to prevent collisions)
- Redirect cache: in-memory LRU + TTL for hot URLs
- Endpoints:
	- POST `/shorten` — upload an HTML file, returns modified HTML
	- GET `/r/:id` — redirect to the original URL

## Project layout
- `web/`: Vite React UI
- `server/`: Express API + Prisma + SQLite
- `examples/`: example HTML for testing

## Data model (Prisma)

```
model Url {
	id           String   @id @default(cuid())
	shortId      String   @unique
	originalUrl  String   @unique
	createdAt    DateTime @default(now())
}
```

Notes:
- `originalUrl` is unique to guarantee the same `shortId` is reused when the same URL appears again.
- The server includes retry-on-collision logic for `shortId` to guard against the extremely rare chance of nanoid collisions.

## Local development

Requirements:
- Node.js 18+
- npm 8+

1) Install dependencies

```bash
# backend
cd server
npm install

# generate prisma client and create DB schema
npx prisma db push
npx prisma generate

# frontend
cd ../web
npm install
```

2) Configure env

- Backend (`server/.env`)
```
DATABASE_URL="file:./dev.db"
PORT=4000
BASE_URL=http://localhost:4000

# Redirect cache (optional; defaults shown)
REDIRECT_CACHE_MAX=1000
REDIRECT_CACHE_TTL_MS=300000          # 5 minutes
REDIRECT_CACHE_NEG_TTL_MS=30000       # 30 seconds for 404s
```

- Frontend (`web/.env`)
```
VITE_API_BASE_URL=http://localhost:4000
```

3) Run

```bash
# terminal 1: backend
cd server
npm run dev

# terminal 2: frontend
cd web
npm run dev
```

Open the frontend at the printed Vite URL (default http://localhost:5173).

## Usage
- Upload an `.html` email file (max 2MB).
- Click "Process HTML". The app posts to `/shorten` and gets modified HTML back.
- Click "Download" to save the processed HTML.
- Optional: Preview the HTML in the iframe.

Only `http` and `https` links are shortened. `mailto:`, `tel:`, `javascript:`, etc. are ignored.

## Example files
- `examples/original.html` — sample input
- `examples/shortened.example.html` — sample output (structure)

## Deployment
- Frontend → Vercel (import `web`)
	- Set `VITE_API_BASE_URL` to your backend URL
- Backend → Render (or similar)
	- Build: `npm install && npx prisma generate && npm run build`
	- Start: `npm start`
	- Environment:
		- `DATABASE_URL` (Render Disk or external DB; SQLite works with persistent disk)
		- `BASE_URL` (your Render URL, e.g., https://your-app.onrender.com)
		- `REDIRECT_CACHE_MAX`, `REDIRECT_CACHE_TTL_MS`, `REDIRECT_CACHE_NEG_TTL_MS` (optional)

Ensure your email links point to `${BASE_URL}/r/:shortId`.

## Scaling & trade-offs
- SQLite is fine for prototype; migrate to Postgres on traffic.
- Redirect cache is in-memory per instance; use Redis for multi-instance deployments.
- `originalUrl` is unique, so the same input URL always maps to the same shortId.
- Rate limiting and basic auth are recommended if exposing publicly.

## Dependencies (server)
- morgan — HTTP request logger middleware (logs each request like `POST /shorten 200 15ms`).
- multer — Multipart/form-data parser for file uploads; used to accept `.html` files at `/shorten`.
- nanoid — Generates short, URL-safe IDs for redirects; we retry on unique conflicts to avoid collisions.
- @prisma/client — Type-safe ORM for DB access (find/create URL rows, etc.).
- cheerio — Server-side HTML parser/manipulator (selects tags and rewrites URLs).