# Droploom

Upload a file, get a link that expires on your terms. Anyone with the link can download the
original file — no account required.

## What works

- **Any file type.** PDFs, images, video, audio, archives, source code, executables, unknown
  extensions and `application/octet-stream` blobs are all accepted. There is no extension
  allow-list; the server never parses, extracts or executes uploads.
- **One upload flow, two pages.** The landing page and the dashboard render the same
  `UploadFlow` component — drag & drop, browse, multi-select, validation and upload behave
  identically.
- **Real uploads.** Files are sent as `multipart/form-data` with progress, a loading state and
  per-file results.
- **Share links.** Every file gets its own random share token; downloads stream the stored
  bytes with the original filename.
- **Custom expiry.** Presets (1 hour / 24 hours / 7 days) plus any custom value from 1 to
  10 080 minutes. The server computes `expires_at` from its own clock.
- **Secure deletion.** Each upload also receives a private delete token (returned once). Only
  its SHA-256 hash is stored; the public share token cannot delete anything.
- **Automatic cleanup.** Expired links stop working immediately, and a job running every
  minute deletes the expired rows and their files.

## Stack

| Layer    | Technology                                                          |
| -------- | ------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS v4                |
| Backend  | Node.js, Express 5, TypeScript, SQLite (`node:sqlite`), Zod, Multer  |
| Security | Helmet, restricted CORS, per-route rate limiting, hashed delete keys |

## Project structure

```
droploom/
├── src/                        # React frontend
│   ├── components/
│   │   ├── display/            # Recent uploads + file cards
│   │   ├── navigation/
│   │   └── upload/             # Shared UploadFlow, dropzone, expiry, results
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

- Frontend: http://localhost:5173 (landing page `/`, dashboard `/upload`)
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

Prefer separate terminals? `npm run dev:frontend` and `npm run dev:server`.

## API

| Method | Path                          | Purpose                                                          |
| ------ | ----------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/uploads`                | `multipart/form-data` with `files` and `expiresInMinutes` (or a legacy preset `expiresIn`) |
| DELETE | `/api/uploads/:deleteToken`   | Permanently deletes a file using its private delete token         |
| GET    | `/api/files/:token`           | Public metadata: filename, size, expiry, download count           |
| GET    | `/api/download/:token`        | Streams the file as an attachment                                 |
| GET    | `/api/uploads/recent`         | Up to six active uploads for the dashboard                        |
| GET    | `/api/health`                 | Liveness + database status                                        |

Expiry input:

- `expiresInMinutes=45` — integer from 1 to 10080 (decimals, 0, negatives and larger values
  are rejected with `400`).
- `expiresIn=1h|24h|7d` — the original presets, still supported.

Upload response (`201`):

```json
{
  "uploads": [
    {
      "token": "AfLlSF1f…",
      "filename": "data.parquet",
      "size": 193,
      "mimeType": "application/octet-stream",
      "extension": "parquet",
      "createdAt": "2026-11-13T06:43:37.000Z",
      "expiresAt": "2026-11-13T07:28:37.000Z",
      "downloadCount": 0,
      "sharePath": "/api/download/AfLlSF1f…",
      "downloadPath": "/api/download/AfLlSF1f…",
      "deleteToken": "Zm9vYmFy…"
    }
  ],
  "rejections": []
}
```

`deleteToken` appears **only** in this upload response. It is never part of the share link,
public metadata or download headers, and the database stores just its SHA-256 hash.

Errors are consistent: `{ "error": { "code": "…", "message": "…", "details": … } }` with
`400` (invalid input), `404` (unknown token / already deleted), `410` (expired), `413` (over
100 MB) or `429` (rate limited). Storage paths are never exposed.

## Deleting a file

The success screen keeps the delete capability in React state, so deletion works without an
account while that tab is open. **Limitation:** because there are no accounts, the delete
token exists only in that page's memory. Navigating away, reloading or clearing browser data
loses the ability to delete early — the file still disappears automatically at its expiry
time. This trade-off is deliberate: a delete capability stored somewhere recoverable would
also be usable by anyone who obtained it.

Deletion removes the physical file and the database row, after which the share link returns
`404`. Repeating the request returns `404` as well.

## Storage and security notes

- Uploads stream to `server/storage/tmp`, are renamed into `server/storage/files` under a
  random name, then recorded in a single transaction. A failed transaction unlinks the moved
  files; temp files are always removed, including on rejection.
- The original filename is sanitised and used only for display and `Content-Disposition`;
  the client name is never used as a path, and stored paths must stay inside the storage root.
- Zero-byte files are rejected deliberately with a clear message, both in the browser and on
  the server.
- Expiry is checked on every download (not just by the cleanup job), so links stop working the
  moment `expires_at` passes.
- Cleanup runs at startup, every `CLEANUP_INTERVAL_MINUTES` (default `1`) and removes the row
  only after the file is gone, so failures are retried on the next pass.

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

42 integration tests drive the real Express app with real files on disk:

- **Formats:** PDF, PNG, MP4, ZIP, JS/TS, EXE, unknown extension, no extension,
  `application/octet-stream`, 0-byte rejection, sparse 100 MB + 1 KB rejection (`413`),
  filename preservation and byte-identical downloads.
- **Sharing:** multiple files per request, unique tokens, metadata without internal paths or
  delete tokens, download counting, 404 for unknown tokens, recent uploads.
- **Deletion:** delete token ≠ share token, only the hash is stored, invalid/share tokens
  rejected, file and row removed, share link 404 afterwards, repeated deletion handled.
- **Expiry:** 1, 5 and 45 minutes, legacy presets, rejection of 0/negative/decimal/>10080
  values, immediate `410` after expiry, and physical deletion during cleanup.
- **Hardening:** CORS origin filtering, JSON 404s, empty upload rejection.
