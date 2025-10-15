import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { PrismaClient, Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';

const app = express();
const upload = multer({
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 4000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// In-memory cache for redirects: shortId -> originalUrl (or null for not found)
// Simple Least Recently Used (LRU) with TTL. Intended to reduce DB lookups for hot URLs.
// TODO: Long-term: use Redis or similar for caching
type CacheEntry = { value: string | null; expiresAt: number };
const redirectCache = new Map<string, CacheEntry>();
const CACHE_MAX_ENTRIES = Number(process.env.REDIRECT_CACHE_MAX || 1000);
const CACHE_TTL_MS = Number(process.env.REDIRECT_CACHE_TTL_MS || 5 * 60 * 1000); // 5 minutes
// TTL for negative cache entries (not found)
const CACHE_404_TTL_MS = Number(process.env.REDIRECT_CACHE_NEG_TTL_MS || 30 * 1000); // 30 seconds for 404s

// Look up key in cache. If not found or expired, return undefined. If found, return value (string or null).
// On hit, refresh TTL and LRU position.
function cacheGet(key: string): string | null | undefined {
  const entry = redirectCache.get(key);
  if (!entry) return undefined; // miss
  if (entry.expiresAt <= Date.now()) {
    redirectCache.delete(key);
    return undefined; // expired
  }
  // refresh LRU and slide TTL for hot keys
  const ttl = entry.value === null ? CACHE_404_TTL_MS : CACHE_TTL_MS;
  redirectCache.delete(key);
  redirectCache.set(key, { value: entry.value, expiresAt: Date.now() + ttl });
  return entry.value;
}

function cacheSet(key: string, value: string | null) {
  const ttl = value === null ? CACHE_404_TTL_MS : CACHE_TTL_MS;
  redirectCache.set(key, { value, expiresAt: Date.now() + ttl });
  // Evict oldest if over capacity
  if (redirectCache.size > CACHE_MAX_ENTRIES) {
    const firstKey = redirectCache.keys().next().value as string | undefined;
    if (firstKey !== undefined) redirectCache.delete(firstKey);
  }
}

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '2mb' }));

// Health
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// Redirect endpoint
// Example: GET /r/abcd1234 -> redirects to original URL
app.get('/r/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Check in-memory cache first
    const cached = cacheGet(id);
    if (cached !== undefined) {
      if (cached === null) return res.status(404).send('Not found');
      return res.redirect(cached);
    }

    // Fallback to DB
    const record = await prisma.url.findUnique({ where: { shortId: id } });
    if (!record) {
      cacheSet(id, null); // negative cache
      return res.status(404).send('Not found');
    }
    cacheSet(id, record.originalUrl);
    return res.redirect(record.originalUrl);
  } catch (err) {
    console.error('Error in redirect handler', err);
    return res.status(500).send('Internal server error');
  }
});

// Util: determine if a URL should be shortened
// Skip anything that's not a real, external web URL; trying to shorten them would either break functionality or make no sense.
function isShortenable(href: string | undefined | null): href is string {
  if (!href) return false;
  const lower = href.trim().toLowerCase();
  if (lower.startsWith('mailto:')) return false;
  if (lower.startsWith('tel:')) return false;
  if (lower.startsWith('javascript:')) return false;
  if (lower.startsWith('#')) return false;
  // Only http(s)
  return lower.startsWith('http://') || lower.startsWith('https://');
}

// Create a Url row with a unique shortId, retrying on rare collisions.
// Collisions are extremely unlikely with nanoid(8), but we guard via the DB unique constraint.
async function createUrlWithUniqueShortId(originalUrl: string, length = 8, maxAttempts = 5): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shortId = nanoid(length);
    try {
      await prisma.url.create({ data: { shortId, originalUrl } });
      return shortId;
    } catch (e) {
      // P2002: Unique constraint failed; if on shortId, retry with a new id
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // If the unique violation is not on shortId, rethrow; otherwise retry
        const target = (e.meta as any)?.target as string[] | string | undefined;
        const targets = Array.isArray(target) ? target : target ? [target] : [];
        if (targets.length === 0 || targets.includes('shortId')) {
          lastError = e;
          continue;
        }
      }
      throw e; // unrelated error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate a unique shortId after multiple attempts');
}

// POST /shorten: accepts HTML and returns processed HTML
app.post('/shorten', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let html = '';

    if (req.is('multipart/form-data')) {
      // For multipart form uploads extract req.file.buffer and convert to string
      const file = req.file; // field name: 'file'
      if (!file) return res.status(400).json({ error: 'No file uploaded as field "file"' });
      html = file.buffer.toString('utf8');
    } else if (req.is('text/html') || req.is('application/json')) {
      // For raw HTML or JSON, extract the HTML content
      const raw = (req.body?.html as string) || (req.body as string);
      if (!raw) return res.status(400).json({ error: 'Missing HTML content' });
      html = raw;
    } else {
      return res.status(415).json({ error: 'Unsupported content type' });
    }

  // Cheerio lets us parse and manipulate HTML in Node.js similar to jQuery
  const $ = cheerio.load(html);

    // Collect and replace href/src attrs on common tags
    const attrTargets: Array<[string, string]> = [
      ['a', 'href'],
      ['area', 'href'],
      ['link', 'href'],
      ['img', 'src'],
      ['script', 'src']
    ];

    // Map to cache existing shortened URLs in this request
    // Ensures we only do one DB lookup+insert per unique URL in the HTML, even if it appears multiple times
    const cache = new Map<string, string>();

    // First pass: collect all URLs to shorten
    for (const [tag, attr] of attrTargets) {
  $(tag).each((_i, el) => {
        const $el = $(el);
        const href = $el.attr(attr);
        if (!isShortenable(href)) return;

        let shortUrl = cache.get(href);
        if (!shortUrl) {
          cache.set(href, ''); // placeholder to avoid duplicate work while awaiting DB
        }
      });
    }

    // Persist distinct unique URLs
    const uniqueUrls = Array.from(new Set(Array.from(cache.keys())));

    if (uniqueUrls.length > 0) {
      // With originalUrl unique, we can upsert safely. We still guard against shortId collision.
      for (const originalUrl of uniqueUrls) {
        // Try to find existing first to avoid writes
  const existing = await prisma.url.findFirst({ where: { originalUrl } });
        let shortId: string;
        if (existing) {
          shortId = existing.shortId;
        } else {
          // Generate id and create; retry on shortId collision
          shortId = await createUrlWithUniqueShortId(originalUrl, 8, 6);
        }
        cache.set(originalUrl, `${BASE_URL}/r/${shortId}`);
      }
    }

    // Apply replacements
    for (const [tag, attr] of attrTargets) {
  $(tag).each((_i, el) => {
        const $el = $(el);
        const href = $el.attr(attr);
        if (!isShortenable(href)) return;
        const shortUrl = cache.get(href!);
        if (shortUrl) $el.attr(attr, shortUrl);
      });
    }

    const output = $.html();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(output);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Ensure DB connection can be established before listening
async function start() {
  await prisma.$connect();
  const server = app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });

  // Graceful shutdown: close HTTP server and Prisma client
  async function shutdown(signal: string) {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
