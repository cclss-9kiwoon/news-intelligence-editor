/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom Vite plugin to proxy Naver article HTML.
 * /api/naver-article?url=<encoded> → fetches the Naver news page and returns HTML.
 * We use a plugin instead of server.proxy because the target URL is dynamic.
 */
/** Block SSRF: only allow http(s) to public IPs */
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname;
    // block private/loopback/link-local ranges
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.startsWith('10.') || host.startsWith('192.168.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith('169.254.') || host.startsWith('0.')) return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
}

function naverArticleProxy(): Plugin {
  return {
    name: 'naver-article-proxy',
    configureServer(server) {
      server.middlewares.use('/api/naver-article', async (req, res) => {
        try {
          const reqUrl = new URL(req.url!, 'http://localhost');
          const targetUrl = reqUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url param' }));
            return;
          }
          if (!isSafeUrl(targetUrl)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'URL blocked: only public http(s) allowed' }));
            return;
          }
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; NIE/1.0)',
              'Accept': 'text/html',
            },
          });
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: `Upstream ${response.status}` }));
            return;
          }

          // Detect charset from Content-Type header or HTML meta tags
          // Many Korean sites (stoo.com, etc.) use EUC-KR instead of UTF-8
          const contentType = response.headers.get('content-type') || '';
          const rawBytes = new Uint8Array(await response.arrayBuffer());

          let charset = 'utf-8';
          // 1. Check Content-Type header for charset
          const headerMatch = contentType.match(/charset=([^\s;]+)/i);
          if (headerMatch) {
            charset = headerMatch[1].toLowerCase().replace(/["']/g, '');
          } else {
            // 2. Peek at first 2KB for <meta charset> or <meta http-equiv="content-type">
            const peek = new TextDecoder('ascii', { fatal: false }).decode(rawBytes.slice(0, 2048));
            const metaMatch = peek.match(/charset=["']?([^\s"';>]+)/i);
            if (metaMatch) {
              charset = metaMatch[1].toLowerCase().replace(/["']/g, '');
            }
          }

          // Normalize common aliases
          if (charset === 'euc-kr' || charset === 'euckr') charset = 'euc-kr';

          const decoder = new TextDecoder(charset, { fatal: false });
          const html = decoder.decode(rawBytes);

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(html);
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/**
 * Settings backup plugin — persists settings to a local JSON file so they
 * survive localStorage wipes (port changes, cache clears, etc.).
 *
 * GET  /api/settings-backup → returns saved settings JSON (or 404)
 * POST /api/settings-backup → saves request body to .nie-settings-backup.json
 */
function settingsBackupPlugin(): Plugin {
  const BACKUP_FILE = path.resolve(__dirname, '.nie-settings-backup.json');

  return {
    name: 'settings-backup',
    configureServer(server) {
      server.middlewares.use('/api/settings-backup', async (req, res) => {
        if (req.method === 'GET') {
          try {
            if (!fs.existsSync(BACKUP_FILE)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'No backup found' }));
              return;
            }
            const data = fs.readFileSync(BACKUP_FILE, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        } else if (req.method === 'POST') {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks).toString('utf-8');
            // Validate it's valid JSON
            JSON.parse(body);
            fs.writeFileSync(BACKUP_FILE, body, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      });
    },
  };
}

export default defineConfig({
  // Relative base so built asset paths work whether Pages serves at the domain
  // root (private repo → *.pages.github.io/) or a /<repo>/ subpath (public project pages).
  base: './',
  plugins: [react(), naverArticleProxy(), settingsBackupPlugin()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      // Dev proxy: /api/extract?url=... → Jina Reader API (fallback + reference articles)
      '/api/extract': {
        target: 'https://r.jina.ai',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const targetUrl = url.searchParams.get('url') || '';
          return '/' + targetUrl;
        },
        headers: {
          'Accept': 'application/json',
        },
      },
      // Dev proxy: Naver Search API — client sends X-Naver-Client-Id/Secret headers
      '/api/naver-search': {
        target: 'https://openapi.naver.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const params = new URLSearchParams();
          params.set('query', url.searchParams.get('query') || '');
          params.set('display', url.searchParams.get('display') || '10');
          params.set('sort', url.searchParams.get('sort') || 'sim');
          return `/v1/search/news.json?${params.toString()}`;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
