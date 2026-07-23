import { defineConfig, type Connect } from 'vite';
import httpProxy from 'http-proxy';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Ktor backend
const BACKEND = 'http://localhost:8080';

// Pull version from top-level build.gradle.kts so FE badge stays in sync
function readAppVersion(): string {
  try {
    const gradle = readFileSync(resolve(__dirname, '..', 'build.gradle.kts'), 'utf8');
    const m = gradle.match(/^\s*version\s*=\s*"([^"]+)"/m);
    return m?.[1] ?? '0.0.0';
  } catch { return '0.0.0'; }
}
const APP_VERSION = readAppVersion();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    port: 5173,
    middlewareMode: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  plugins: [
    {
      name: 'notepad-backend-proxy',
      configureServer(server) {
        const proxy = httpProxy.createProxyServer({
          target: BACKEND,
          changeOrigin: true,
          ws: true,
          xfwd: true,
        });
        proxy.on('error', (err) => console.error('[proxy]', err.message));

        const mw: Connect.NextHandleFunction = (req, res, next) => {
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            proxy.web(req, res);
            return;
          }
          // Proxy admin API GETs to backend too
          if (req.url?.startsWith('/admin/')) {
            proxy.web(req, res);
            return;
          }
          next();
        };
        server.middlewares.use(mw);

        server.httpServer?.on('upgrade', (req, sock, head) => {
          if (req.url?.startsWith('/ws')) proxy.ws(req, sock, head);
        });
      },
    },
    {
      // SPA fallback: unknown GETs → index.html, EXCEPT /admin → admin.html
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (
            req.method === 'GET' &&
            req.url &&
            !req.url.startsWith('/@') &&
            !req.url.startsWith('/src') &&
            !req.url.startsWith('/node_modules') &&
            !req.url.includes('.') &&
            req.url !== '/'
          ) {
            if (req.url === '/admin' || req.url.startsWith('/admin?')) {
              req.url = '/admin.html';
            } else {
              req.url = '/';
            }
          }
          next();
        });
      },
    },
  ],
});
