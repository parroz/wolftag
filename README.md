# tag2print (Phase 1)

Local web app for promotional product tag printing with:
- CSV batch import
- batch-scoped product search
- backend print service abstraction
- Brother raster first path with safe fallback to mock

## Stack

- Frontend: React + Vite (`/Users/arroz/pit2tag/frontend`)
- Backend: Node.js + Express + SQLite (`/Users/arroz/pit2tag/backend`)

## Environment

Copy `/Users/arroz/pit2tag/backend/.env.example` to `.env` if needed:

```bash
cp /Users/arroz/pit2tag/backend/.env.example /Users/arroz/pit2tag/backend/.env
```

Key settings:
- `PRINTER_IP=192.168.1.122`
- `PRINTER_MODEL=PT-P750W`
- `PRINT_MODE=mock|brother-raster|system-driver`

## Run

Install dependencies:

```bash
npm install
npm install --prefix /Users/arroz/pit2tag/backend
npm install --prefix /Users/arroz/pit2tag/frontend
```

Run migrations:

```bash
npm run migrate
```

Start frontend + backend:

```bash
npm run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## API

- `POST /api/batches`
- `GET /api/batches`
- `POST /api/batches/:batchId/import-csv`
- `GET /api/products/search?batchId=&q=`
- `GET /api/products/:id`
- `POST /api/print-tag`

## Print modes

- `mock`: always simulate print for development/testing.
- `brother-raster`: render a label bitmap and send Brother-compatible raster command bytes via TCP to `PRINTER_IP:PRINTER_PORT`.
- `system-driver`: scaffold only in Phase 1 (returns not implemented status).

When `PRINT_MODE=brother-raster`, the service uses automatic fallback:
- if Brother printing fails (offline/timeout/connection/protocol/write failure), it switches to `MockPrintService`;
- `/api/print-tag` still returns success response with:
  - `modeUsed: "mock"`
  - `fallbackTriggered: true`
  - `warning` with the Brother failure reason.

This keeps the shop-floor UI responsive and non-blocking.

## CSV format

Required headers (Portuguese accepted):
- `Referencia`
- `Descricao` / `Descrição`
- `PVP Inicial`
- `Baixa %`
- `PVP Promo`

Import behavior:
- trims strings
- accepts comma or dot decimal formats
- upserts by unique `(batch_id, referencia)`
- returns summary with imported/skipped rows and validation errors

## Tests

Run backend tests:

```bash
npm run test --prefix /Users/arroz/pit2tag/backend
```
