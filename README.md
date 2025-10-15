# URL Shortener (HTML Email Parser)

Full-stack TypeScript app that shortens URLs in uploaded HTML email files. It parses links in the HTML, stores originals in a database, generates short redirect URLs, and returns the modified HTML for download or preview.

## Highlights
- Frontend: React + TypeScript (Vite), TailwindCSS
- Backend: Express + TypeScript, Prisma ORM (SQLite by default)
- Parsing: Cheerio
- Short IDs: nanoid
- Endpoints:
	- POST `/shorten` — upload an HTML file, returns modified HTML
	- GET `/r/:id` — redirect to the original URL

## Architecture
- apps/web: Vite React UI
- apps/server: Express API + Prisma + SQLite
- examples/: example HTML for testing

Data model (Prisma):

```
model Url {
	id           String   @id @default(cuid())
	shortId      String   @unique
	originalUrl  String
	createdAt    DateTime @default(now())
}
```

## Local Development

Requirements:
- Node.js 18+
- npm 8+

1) Install dependencies

```bash
# backend
cd apps/server
npm install

# generate prisma client and create DB schema
npx prisma db push
npx prisma generate

# frontend
cd ../web
npm install
```

2) Configure env

- Backend (`apps/server/.env`)
```
DATABASE_URL="file:./dev.db"
PORT=4000
BASE_URL=http://localhost:4000
```

- Frontend (`apps/web/.env`)
```
VITE_API_BASE_URL=http://localhost:4000
```

3) Run

```bash
# terminal 1: backend
cd apps/server
npm run dev

# terminal 2: frontend
cd apps/web
npm run dev
```

Open the frontend at the printed Vite URL (default http://localhost:5173).

## Usage
- Upload an `.html` email file.
- Click "Process HTML". The app posts to `/shorten` and gets modified HTML back.
- Click "Download" to save the processed HTML.
- Optional: Preview the HTML in the iframe.

Only `http` and `https` links are shortened. `mailto:`, `tel:`, `javascript:`, etc. are ignored.

## Example files
- `examples/original.html` — sample input
- `examples/shortened.example.html` — sample output (structure)

## Deployment
- Frontend → Vercel (import `apps/web`)
	- Set `VITE_API_BASE_URL` to your backend URL
- Backend → Render (free web service)
	- Build: `npm install && npx prisma generate && npm run build`
	- Start: `npm start`
	- Environment:
		- `DATABASE_URL` (Render Disk or external DB; SQLite works with persistent disk)
		- `BASE_URL` (your Render URL, e.g., https://your-app.onrender.com)

Ensure your email links point to `${BASE_URL}/r/:shortId`.

## Scaling & trade-offs
- SQLite is fine for prototype; migrate to Postgres on traffic.
- Add caching for redirects (e.g., LRU or Redis) if hot.
- Consider deduplicating by `originalUrl` to reuse the same `shortId` (implemented in code).
- Add rate limiting and basic auth if exposing publicly.

## License
MIT

