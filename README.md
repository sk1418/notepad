# Notepad

A minimal, self-hosted online notepad.
Open a URL, start typing — your text is saved automatically and synced to any tab pointing at the same URL.

[Demo](https://note.showcase.gleeze.com) *Note: The data of the demo will be wiped on an ad-hoc basis*

**Ktor + Kotlin** backend · **Vite + TypeScript** frontend · **SQLite** storage · ships as a single Docker image.

---

## Features

**Editing & sync**
- URL is the identity — visit `/anything` and you have a note.
- Live sync over WebSocket, debounced per keystroke, multi-tab safe.
- Auto-reconnect with exponential back-off; unsent edits are buffered and flushed.
- `Cmd/Ctrl-S` forces an immediate flush.
- 20 MB max content size per note.

**Presentation**
- Light / Dark theme (Solarized-dark variant).
- Font family (15+ mono / sans / serif), font size (12–48 px), line wrapping, line numbers.
- All view settings saved **per note** in `localStorage` (LRU-capped at 200).

**Sharing**
- Password protect / change / remove per note.
- Read-only share link, one-click copy.
- View as **raw text** or **rendered Markdown** (with highlight.js syntax highlighting).

**Admin page (`/admin`)**
- Opt-in via `NOTEPAD_ADMIN_PW` env var. Disabled by default.
- Login-gated table of all notes with size, updated timestamp, password (cleartext), share URL.
- Click a note key to view full content in a popup (or open it in a new tab).
- Per-row actions: **open**, **set / change / remove password**, **delete**.
- Bulk-select + bulk-delete.
- Sortable by size or updated time.
- Rate-limited login (1 attempt / 3 s); admin session auto-expires after 8 h.

**Hardening**
- Signed session cookies (`SameSite=Strict`, `HttpOnly`, `Secure` in prod).
- WebSocket bound to your own note key — cross-note writes blocked.
- Rate limits on unlock, admin login, and writes.
- App refuses to start if `SESSION_SIGN_KEY` is unset or equals the known leaked default.

---

## How to self-host

### 1. Requirements
- Docker (or Podman) — nothing else on the host.

### 2. Environment variables

| Env var                       | Required                     | Purpose                                                                                          |
|-------------------------------|------------------------------|--------------------------------------------------------------------------------------------------|
| `SESSION_SIGN_KEY`            | **Yes**                      | Random hex ≥ 32 chars for signing session cookies. Generate with `openssl rand -hex 32`. App refuses to start without it. |
| `NOTEPAD_ADMIN_PW`            | No (unset → admin disabled)  | Plain-text password for the `/admin` page. Leave unset to hide/disable the admin feature.        |
| `DB_URL`                      | No (`jdbc:sqlite:/data/note.db` in Docker) | Any JDBC URL Exposed supports.                                                                   |
| `DB_DRIVER`                   | No (`org.sqlite.JDBC`)       | Change if using another DB backend.                                                              |
| `DB_USER` / `DB_PASSWORD`     | No                           | Only for non-SQLite backends.                                                                    |
| `ktor.deployment.environment` | No (`dev`)                   | Set to `prod` to enable the `Secure` cookie flag (requires HTTPS).                               |

### 3. Run with Docker

```bash
docker run -d --name notepad \
  -p 8080:8080 \
  -v $HOME/notepad-data:/data \
  -e SESSION_SIGN_KEY=$(openssl rand -hex 32) \
  -e NOTEPAD_ADMIN_PW=change-me \
  ghcr.io/sk1418/notepad:latest    # or your own image
```

Notepad now lives at http://localhost:8080 and the admin panel at http://localhost:8080/admin.

### 4. Or with docker-compose

```yaml
services:
  notepad:
    image: notepad:latest
    restart: unless-stopped
    ports: ["8080:8080"]
    volumes:
      - ./notepad-data:/data
    environment:
      DB_URL: jdbc:sqlite:/data/note.db
      SESSION_SIGN_KEY: ${SESSION_SIGN_KEY:?run: openssl rand -hex 32}
      NOTEPAD_ADMIN_PW: ${NOTEPAD_ADMIN_PW:-}
      # ktor.deployment.environment: prod   # uncomment behind HTTPS
```

### 5. Build your own image

```bash
./scripts/build-and-push.sh   # multi-arch (amd64 + arm64), pushed to Docker Hub
```

or

```bash
docker build -t notepad:local .
```

### 6. Behind a reverse proxy
- Enable HTTPS at the proxy layer, then set `ktor.deployment.environment=prod`.
- Forward WebSocket upgrades on `/ws/*`.

---

## License

MIT — see [LICENSE](LICENSE).