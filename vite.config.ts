import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MATCHES_FILE = path.join(__dirname, 'matches.json')

/**
 * Vite plugin that exposes a file-storage API at /data/matches.
 * Match data is read from / written to matches.json on disk, so it is shared
 * across all ports and all browsers on the same machine.
 *
 * GET  /data/matches  → returns { matches: [...] }
 * POST /data/matches  → writes { matches: [...] } to matches.json
 */
function fileStoragePlugin(): Plugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function attachMiddleware(server: any): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.middlewares.use('/data/matches', (req: any, res: any, next: () => void) => {
      if (req.method === 'GET') {
        try {
          const raw = fs.existsSync(MATCHES_FILE)
            ? fs.readFileSync(MATCHES_FILE, 'utf-8')
            : '{"matches":[]}'
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(raw)
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to read matches file' }))
        }
        return
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const parsed: unknown = JSON.parse(body)
            if (
              !parsed ||
              typeof parsed !== 'object' ||
              !Array.isArray((parsed as { matches?: unknown }).matches)
            ) {
              throw new Error('Invalid format: expected { matches: [...] }')
            }
            fs.writeFileSync(MATCHES_FILE, JSON.stringify(parsed, null, 2), 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end('{"ok":true}')
          } catch (err: unknown) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
          }
        })
        return
      }

      next()
    })
  }

  return {
    name: 'file-storage',
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    fileStoragePlugin(),
  ],
  server: {
    // Preferred default port. The file-storage plugin writes to matches.json
    // on disk, so data is shared across all ports — but always use `npm run dev`.
    port: 5173,    // Exclude matches.json from HMR watching — the file-storage plugin writes
    // to it at runtime; without this, every save would trigger an infinite HMR loop.
    watch: {
      ignored: ['**/matches.json'],
    },    proxy: {
      '/api/osu': {
        target: 'https://osu.ppy.sh',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osu/, ''),
        secure: true,
      },
    },
  },
})
