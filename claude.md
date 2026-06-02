# WolfTag — CLAUDE.md

## What this is

Local shop-floor web app for printing promotional price tags. Workers scan a barcode or type a product reference, see the price drop details, and send it to a Brother label printer. Products are grouped into **batches** that correspond to a promotional CSV file from the buying team.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 5, TypeScript, SQLite (`better-sqlite3`) |
| Frontend | React + Vite, TypeScript |
| Validation | Zod (backend boundaries only) |
| Label rendering | Jimp (bitmap), then Brother raster TCP protocol |
| Tests | Vitest + Supertest |

## Directory layout

```
pit2tag/
  backend/src/
    app.ts                       # All Express routes
    server.ts                    # HTTP server entry point (port 3000)
    config/env.ts                # Env var schema via Zod
    db/
      database.ts                # SQLite singleton
      runMigrations.ts           # Runs SQL files in migrations/
      migrations/001_init.sql    # Schema: batches + products tables
    modules/
      batches/batchRepository.ts
      import/csvImportService.ts
      products/productRepository.ts
      print/
        PrintService.ts               # Interface + result types
        MockPrintService.ts
        BrotherRasterPrintService.ts
        SystemDriverPrintService.ts   # Scaffold only (Phase 1)
        printServiceFactory.ts        # ResilientPrintService + createPrintService()
        labelRenderer.ts              # Jimp bitmap layout
        brotherRasterEncoder.ts       # Brother raster protocol bytes
    tests/phase1.test.ts
  frontend/src/
    App.tsx / App.css            # Shell, header, NavLink nav
    index.css                    # CSS variables + dot-grid background
    pages/
      SearchPage.tsx             # Primary flow: scan → product card → print
      ImportPage.tsx             # Batch creation + CSV upload
    api.ts                       # fetch() wrappers for all endpoints
    types.ts                     # Shared TypeScript interfaces
```

## Commands

```bash
# First-time setup
npm install
npm install --prefix backend
npm install --prefix frontend

# Run DB migrations (required on first run and after schema changes)
npm run migrate

# Start both servers with hot reload
npm run dev
# → Frontend: http://localhost:5173
# → Backend:  http://localhost:3000

# Run backend tests
npm run test

# Production build
npm run build
```

## Environment

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Backend HTTP port |
| `DB_PATH` | hardcoded absolute path | See gotcha below |
| `PRINT_MODE` | `mock` | `mock` / `brother-raster` / `system-driver` |
| `PRINTER_IP` | `192.168.1.122` | Used only in `brother-raster` mode |
| `PRINTER_PORT` | `9100` | Brother TCP port |
| `LABEL_WIDTH_MM` | `12` | Tape width — affects bitmap layout (12 or 24 mm) |

**Gotcha — DB_PATH**: the default in `config/env.ts` is currently an absolute path (`/Users/arroz/pit2tag/backend/data/app.db`). If moving to a different machine, set `DB_PATH` explicitly in `.env` or update that default.

## Architecture — key patterns

### Print service

`printServiceFactory.ts` exports `createPrintService()` which picks the right service from `PRINT_MODE`. In `brother-raster` mode, it wraps the primary in `ResilientPrintService`, which catches all errors and falls back to `MockPrintService`. The API response always includes `fallbackTriggered: boolean` and an optional `warning` string. `system-driver` mode is scaffolded only and returns a "not implemented" error.

When adding a new print mode: implement `PrintService` interface, register in `printServiceFactory.ts`.

### CSV import

The buying team exports their `.xlsx` promo file to CSV before uploading (the app parses CSV text, not Excel binaries).

- Expected columns: `Referencia, Designacao, Cor, Tam, EAN, PVP, Perc, PPromo` (mapped to `referencia, descricao, cor, tam, ean, pvp_inicial, baixa_percent, pvp_promo`)
- Delimiter auto-detected from first line (`,` or `;`)
- Column headers normalised: diacritics stripped, lowercased — `Designação` and `Designacao` both work
- Numerics accept comma or dot decimal: `29,99` and `29.99` both parse correctly
- `cor` and `tam` are optional (default `''`); a row is skipped if `referencia`, `descricao`, `ean`, or any price is missing/invalid
- Import is an **upsert** on `(batch_id, ean)` — re-importing the same file updates prices, no duplicates. **`referencia` is NOT unique**: one reference spans many colour/size variants, each with its own EAN.

### Search ranking

`searchProducts()` returns up to 50 results ranked:
- Rank 0: exact `ean` match, or exact `referencia` match (case-insensitive)
- Rank 1: `ean` or `referencia` contains query
- Rank 2: `descricao` contains query

Ties break by `referencia`, then `tam`. The first result is auto-selected in the UI, so an EAN barcode scan lands on exactly one variant; typing a reference lists all its variants to choose from.

### Database schema

Two tables: `batches` (`id`, `name UNIQUE`, `created_at`) and `products` (`id`, `batch_id FK`, `referencia`, `descricao`, `cor`, `tam`, `ean`, `pvp_inicial`, `baixa_percent`, `pvp_promo`, `created_at`). Unique constraint on `(batch_id, ean)`. All queries are synchronous via `better-sqlite3` except the print path (async TCP).

Migrations are tracked in a `_migrations` table and each `.sql` file in `migrations/` runs exactly once (in filename order). Idempotent `CREATE IF NOT EXISTS` files are safe; destructive migrations (e.g. `003_products_ean.sql`, which rebuilds `products`) rely on this run-once guarantee. Bump the numeric prefix for new migrations — never edit an applied one.

## Frontend design system

The aesthetic is **dark industrial** — shop-floor legible, high contrast, amber accents. Maintain this character when adding new screens.

### Fonts (loaded in `index.html` from Google Fonts)

- **Bebas Neue** (`--font-display`) — large numbers: discount %, promo price
- **Barlow Condensed** (`--font-ui`) — all UI text: labels, buttons, nav
- **DM Mono** (`--font-mono`) — barcode/ref fields and code-like content

### CSS variables (`index.css`)

```css
--bg: #0c0d10          /* page background (dot-grid texture) */
--surface: #14161c     /* panel/card background */
--surface-2: #1c1f28   /* input background */
--border: #23262f
--border-bright: #343848
--text: #dde1ec
--text-muted: #6b7089
--accent: #f5a623      /* amber — primary actions, product card stripe */
--accent-dim: rgba(245, 166, 35, 0.1)
--accent-hover: #ffb836
--danger: #ff453a
--ok: #34c759
--warn: #ff9f0a
--radius: 10px
--radius-lg: 16px
```

### UI rules

- Keep CSS in the existing stylesheet files, not inline styles (exception: one-off dynamic colour values)
- Use `.status.ok` / `.status.warning` / `.status.error` for all feedback messages
- Animate new panels/cards with `animation: fadeUp 0.3s ease-out` (keyframe defined in `App.css`)
- Use `NavLink` (not `Link`) from react-router-dom so the active tab highlights correctly

### Aesthetics philosophy

Avoid generic AI outputs. Don't default to predictable layouts, overused font families (Inter, Roboto, system fonts), or clichéd colour schemes. The current theme is intentional and context-specific — industrial, amber-on-dark, thermal-printer-inspired. Maintain this character. If a new screen calls for a different visual treatment, commit fully to it rather than blending blandly with the rest.

## Docker deployment

Only the **backend** runs in Docker. The frontend is built as static files served by the host nginx (same pattern as other apps on the server).

```
Browser → host nginx (port 80) → /api/* → 127.0.0.1:3000 (Docker backend)
                                → /*     → /var/www/wolftag (static files)
```

### First deploy

```bash
cp .env.docker .env          # edit BACKEND_PORT and printer defaults
./scripts/deploy.sh          # builds frontend, syncs to /var/www/wolftag, starts backend
```

On first deploy the script also prints the nginx setup commands:
```bash
sudo cp nginx.wolftag.conf /etc/nginx/sites-available/wolftag
sudo ln -s /etc/nginx/sites-available/wolftag /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Subsequent deploys (after code changes)

```bash
./scripts/deploy.sh    # rebuilds frontend + restarts backend container
```

### Useful commands

```bash
docker compose up -d --build      # rebuild and restart backend only
docker compose down               # stop backend (data volume preserved)
docker compose logs -f backend    # stream backend logs
```

### Data persistence

The SQLite database lives in a named Docker volume (`wolftag-data`) at `/data/app.db` inside the container. Survives `docker compose down` and rebuilds. To back up:

```bash
docker run --rm -v wolftag_wolftag-data:/data -v $(pwd):/backup \
  alpine cp /data/app.db /backup/wolftag-backup.db
```

### Port configuration

`BACKEND_PORT` in `.env` (default `3000`) is the port the backend container binds to on `127.0.0.1`. Only the host nginx can reach it — it is not accessible from outside the server. If port 3000 conflicts with another container, change it and update `nginx.wolftag.conf` to match.

### Printing

The backend container opens a TCP socket to `PRINTER_IP:9100`. It inherits the host's network stack (bridge mode), so it can reach any device on the LAN — including the Brother printer. No extra configuration needed beyond setting the correct IP in the Settings UI.

### Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Backend container only |
| `nginx.wolftag.conf` | Drop into host nginx `sites-available/` |
| `scripts/deploy.sh` | Full deploy: build → sync → restart |
| `.env.docker` | Template — copy to `.env` |
| `frontend/Dockerfile` | Available if a containerised build is ever needed |

## Internationalisation (i18n)

The frontend uses **i18next + react-i18next**. Portuguese (`pt`) is the default and only complete locale. English (`en`) is a ready-to-fill stub.

### File layout

```
frontend/src/i18n/
  index.ts            # i18next init — sets lng: "pt", bundles both locales
  locales/
    pt.json           # Default locale (complete)
    en.json           # Stub — fill in to add English support
```

### Adding a new language

1. Copy `en.json` to `<locale>.json` (e.g. `fr.json`) and translate all values.
2. Import it in `i18n/index.ts` and add it to the `resources` object:
   ```ts
   import fr from "./locales/fr.json";
   export const resources = {
     pt: { translation: pt },
     en: { translation: en },
     fr: { translation: fr },
   } as const;
   ```
3. To switch language at runtime: `import i18n from "./i18n"; i18n.changeLanguage("fr")`.

### Using translations in components

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  return <button>{t("search.printButton")}</button>;
}
```

Interpolation (for strings with variables): `t("import.summaryRow", { row: 3, message: "..." })`

### Translation keys structure

Keys are nested by page/scope (`app`, `nav`, `common`, `search`, `import`). TypeScript will autocomplete and type-check keys because the `pt.json` shape is registered in `i18next`'s `CustomTypeOptions` in `index.ts`.

### Backend strings

Backend user-facing strings (API error messages, print result messages) are hardcoded in Portuguese directly in the source. They flow to the frontend as `error` or `message` fields in API responses and are displayed as-is. If backend i18n is ever needed, add `Accept-Language` middleware and a message map — but for a local single-locale deployment, hardcoding is sufficient.

## Testing

Tests live in `backend/src/tests/phase1.test.ts`. Framework is Vitest + Supertest.

**Rules:**
- Tests hit a **real SQLite database** — no mocks for the DB layer. The `beforeEach` block clears `products` and `batches` tables.
- Import `"../db/runMigrations.js"` at the top of any new test file to ensure the schema exists before tests run.
- Use `supertest` with the `app` export from `app.ts` for HTTP endpoint tests.
- For service-layer tests, instantiate the class directly (see the print fallback tests as the pattern).

**When adding a feature, add tests covering:**
1. The happy path
2. The key edge case (malformed input, not-found, fallback trigger, etc.)

Run tests: `npm run test` from repo root, or `npm run test --prefix backend`.

## Git workflow

This repo is **not yet initialised** as a git repository. To start tracking:

```bash
git init
git add .
git commit -m "initial commit"
```

**Conventions:**
- Imperative mood, lowercase: `add batch delete endpoint`, `fix csv decimal parsing`
- One logical change per commit — don't bundle unrelated fixes
- **Always ask before pushing to a remote** — confirm the remote URL and branch
- Never force-push without explicit instruction

## Working style

**Ask before proceeding when:**
- There are multiple reasonable approaches — present them briefly and wait for a choice
- The change touches: print service interface, database schema, or CSV import contract (data integrity risk)
- A new `npm` dependency is needed — state what it is and why before installing
- The scope is unclear or larger than expected

**Just do it (no need to ask) for:**
- CSS/style changes
- Adding a field to an existing API response
- Writing tests for existing code
- Fixing a clear bug with an obvious fix
