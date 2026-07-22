import { defineConfig, type Connect } from 'vite';
import httpProxy from 'http-proxy';

// Ktor backend
const BACKEND = 'http://localhost:8080';

// Path-based proxy isn't enough — BE serves POST `/{key}` which clashes with
// SPA GETs. Forward all non-GET (and /ws) requests to the backend, let GETs
// fall through to Vite (so any URL serves index.html for the SPA).
export default defineConfig({
  server: {
    port: 5173,
    middlewareMode: false,
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
          next();
        };
        server.middlewares.use(mw);

        // WebSocket upgrade
        server.httpServer?.on('upgrade', (req, sock, head) => {
          if (req.url?.startsWith('/ws')) proxy.ws(req, sock, head);
        });
      },
    },
    {
      // Make sure deep URLs (e.g. /abc) serve index.html for the SPA.
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
            req.url = '/';
          }
          next();
        });
      },
    },
  ],
});
