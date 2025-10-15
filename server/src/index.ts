import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const app = express();
const upload = multer();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 4000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '2mb' }));

// Health
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// Redirect endpoint
app.get('/r/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await prisma.url.findUnique({ where: { shortId: id } });
  if (!record) return res.status(404).send('Not found');
  return res.redirect(record.originalUrl);
});

// Util: determine if a URL should be shortened
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

// POST /shorten: accepts HTML and returns processed HTML
app.post('/shorten', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let html = '';

    if (req.is('multipart/form-data')) {
      const file = req.file; // field name: 'file'
      if (!file) return res.status(400).json({ error: 'No file uploaded as field "file"' });
      html = file.buffer.toString('utf8');
    } else if (req.is('text/html') || req.is('application/json')) {
      // support raw HTML or JSON { html }
      const raw = (req.body?.html as string) || (req.body as string);
      if (!raw) return res.status(400).json({ error: 'Missing HTML content' });
      html = raw;
    } else {
      return res.status(415).json({ error: 'Unsupported content type' });
    }

    const $ = cheerio.load(html, { decodeEntities: false });

    // Collect and replace href/src attrs on common tags
    const attrTargets: Array<[string, string]> = [
      ['a', 'href'],
      ['area', 'href'],
      ['link', 'href'],
      ['img', 'src'],
      ['script', 'src']
    ];

    // Map to cache existing shortened URLs in this request
    const cache = new Map<string, string>();

    for (const [tag, attr] of attrTargets) {
  $(tag).each((_i: number, el: cheerio.Element) => {
        const $el = $(el);
        const href = $el.attr(attr);
        if (!isShortenable(href)) return;

        let shortUrl = cache.get(href);
        if (!shortUrl) {
          cache.set(href, ''); // placeholder to avoid duplicate work while awaiting DB
        }
      });
    }

    // Persist unique URLs and compute short URLs
    const uniqueUrls = Array.from(new Set(Array.from(cache.keys())));

    for (const originalUrl of uniqueUrls) {
      // Deduplicate by originalUrl: reuse same shortId if exists
      const existing = await prisma.url.findFirst({ where: { originalUrl } });
      let shortId: string;
      if (existing) {
        shortId = existing.shortId;
      } else {
        shortId = nanoid(8);
        await prisma.url.create({ data: { shortId, originalUrl } });
      }
      const shortUrl = `${BASE_URL}/r/${shortId}`;
      cache.set(originalUrl, shortUrl);
    }

    // Apply replacements
    for (const [tag, attr] of attrTargets) {
  $(tag).each((_i: number, el: cheerio.Element) => {
        const $el = $(el);
        const href = $el.attr(attr);
        if (!isShortenable(href)) return;
        const shortUrl = cache.get(href!);
        if (shortUrl) $el.attr(attr, shortUrl);
      });
    }

    const output = $.html({ decodeEntities: false });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(output);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
