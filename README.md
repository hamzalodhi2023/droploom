# Droploom

Upload a file, get a link that expires on your terms. Anyone with the link can download the
original file — no account required.

## What works

- **Real uploads.** The dashboard sends actual `File` objects as `multipart/form-data` to
  `POST /api/uploads`, with upload progress, a loading state and per-file results.
- **Real downloads.** Every accepted file gets its own cryptographically random share token.
  `GET /api/download/:token` streams the stored bytes back with the original filename.
- **Expiry.** Links expire after 1 hour, 24 hours or 7 days. Expired links return `410 Gone`,
  and a cleanup job deletes both the row and the file from disk.
- **Server-side validation.** Extension allow-list (PDF, DOC, DOCX, TXT, ZIP, RAR), 100 MB per
  file, and magic-byte checks so an executable renamed to `.pdf` is rejected.

## Stack

| Layer    | Technology                                                              |
| -------- | ----------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS v4                    |
| Backend  | Node.js, Express 5, TypeScript, SQLite (`node:sqlite`), Zod, Multer      |
| Security | Helmet, restricted CORS, per-route rate limiting, secure share tokens   |

## Project structure

```
droploom/
├── src/                        # React frontend
│   ├── components/
│   │   ├── display/            # Recent uploads + file cards
│   │   ├── navigation/
│   │   └── upload/             # Dropzone, selection list, expiry, results
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   ├── utils/                  # api client, validation, date formatting
│   ├── types.ts
│   └── main.tsx
├── server/
│   ├── src/
│   │   ├── config/env.ts       # Zod-validated environment
│   │   ├── database/           # SQLite connection + migrations
│   │   ├── modules/
│   │   │   ├── health/         # GET /api/health
│   │   │   └── uploads/        # routes, controller, service, repository, validation
│   │   ├── middleware/         # errors, rate limits, multer disk storage
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── storage/                # runtime: files/ and tmp/ (never web-served)
│   ├── data/                   # runtime: SQLite database
│   └── tests/                  # integration tests + fixtures
├── public/
├── vite.config.ts              # dev proxy: /api → http://localhost:4000
└── package.json
```

`server/storage` and `server/data` are runtime directories and are git-ignored.

## Getting started

```bash
npm install
npm --prefix server install

cp server/.env.example server/.env
npm run dev
```

`npm run dev` starts both services:

- Frontend: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

The Vite dev server proxies `/api` to the API, so the browser only ever talks to one origin.

Prefer separate terminals? `npm run dev:frontend` and `npm run dev:server`.

## API

| Method | Path                    | Purpose                                                         |
| ------ | ----------------------- | --------------------------------------------------------------- |
| POST   | `/api/uploads`          | `multipart/form-data` with `files[]` and `expiresIn` (`1h`/`24h`/`7d`) |
| GET    | `/api/files/:token`     | Public metadata: filename, size, expiry, download count          |
| GET    | `/api/download/:token`  | Streams the file as an attachment                               |
| GET    | `/api/uploads/recent`   | Up to six active uploads for the dashboard                      |
| GET    | `/api/health`           | Liveness + database status                                      |

Upload response (`201`):

```json
{
  "uploads": [
    {
      "token": "AfLlSF1f…",
      "filename": "contract.pdf",
      "size": 193,
      "mimeType": "application/pdf",
      "extension": "pdf",
      "createdAt": "2026-11-13T06:43:37.000Z",
      "expiresAt": "2026-11-14T06:43:37.000Z",
      "downloadCount": 0,
      "sharePath": "/api/download/AfLlSF1f…",
      "downloadPath": "/api/download/AfLlSF1f…"
    }
  ],
  "rejections": []
}
```

Errors are consistent: `{ "error": { "code": "…", "message": "…", "details": … } }` with
`400` (invalid input), `404` (unknown token), `410` (expired), `413` (too large) or `429`
(rate limited). Storage paths are never exposed.

## Storage and security notes

- Uploads stream to `server/storage/tmp`, are validated, then renamed into
  `server/storage/files` under a random token — the client filename is never used as a path.
- File + metadata writes are atomic: if the SQLite transaction fails, the moved files are
  deleted, and temporary files are always removed, including on rejection.
- Downloads check expiry, verify the stored path stays inside the storage root, then stream
  with `Content-Disposition: attachment` (ASCII fallback + RFC 5987 filename).
- `server/storage` is never served statically.
- Expired records are cleaned at startup, on an interval
  (`CLEANUP_INTERVAL_MINUTES`), and are rejected on every download.

## Scripts

| Command                    | Description                              |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Frontend + API together                  |
| `npm run dev:frontend`     | Vite dev server only                     |
| `npm run dev:server`       | API with `tsx watch` only                |
| `npm run build`            | Type-check and build the frontend        |
| `npm run build:server`     | Compile the API to `server/dist`         |
| `npm run typecheck:server` | Strict type-check for the API            |
| `npm run test:server`      | Integration tests (`node:test` + supertest) |

## Tests

```bash
npm run test:server
```

The suite drives the real Express app and real files on disk. It covers valid PDF/TXT/ZIP and
multi-file uploads, unsupported `.exe`, oversized files, an executable renamed to `.pdf`,
token uniqueness, metadata, byte-identical downloads, download counting, invalid and expired
tokens, physical file deletion during cleanup, no orphaned files after failures, CORS, and JSON
404 handling.
