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
  its SHA-256 hash is stored; the public share token cannot delete anything. Recent uploads
  can be deleted from the dashboard, using the capability kept in this browser's IndexedDB.
- **One-time downloads.** A link is consumed only by a *completed* transfer: the file and its
  record are deleted after the last byte is flushed, never on a page view, an aborted transfer
  or a client disconnect.
- **Automatic cleanup.** Expired links stop working immediately, and a job running every
  minute deletes expired rows, files, and any one-time deletion still waiting for storage.

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

Deletion is available from the upload result panel and from every card under **Recent
uploads**. Both use the same confirmation dialog (filename, permanent removal, link 404), the
same loading state and the same error reporting. The recent-uploads API never returns delete
tokens: the browser keeps the capability it received in the upload response.

Capabilities are stored per browser in IndexedDB (`droploom-delete-vault`). After a reload the
same browser can still delete its own files; another browser, or the same browser with site
data cleared, cannot. Those cards show a disabled Delete button with an explanation instead of
failing silently. Files remain deletable by expiry, by their first complete download, or from
the original browser.

Deletion removes the physical file and the database row, after which the share link returns
`404`. Repeating the request returns `404` as well. If the filesystem refuses the delete, the
row is kept marked `pending_delete` (hidden from sharing) so the cleanup job can retry.

## One-time download links

`GET /api/download/:token` streams the file and, **only after the transfer completed**, deletes
the stored file and the row. The deletion is triggered from the successful
`stream.pipeline(stream, res)` callback:

- Viewing `GET /api/files/:token` (opening a share page) never deletes anything.
- An aborted request, a client disconnect or a read error rejects the pipeline; the file is
  kept and the link can be retried.
- In-flight transfers are counted per token. Deletion waits until the last reader finishes, so
  simultaneous downloads all receive the full file and exactly one cleanup happens.
- If storage refuses deletion, the row is flagged `pending_delete`, sharing immediately returns
  `404`, and the cleanup job retries; the row is only removed once the file is gone.
- Download attempts increment `download_count` when the stream opens, including interrupted
  ones; a completed download removes the row entirely.

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

47 integration tests drive the real Express app with real files on disk:

- **Formats:** PDF, PNG, MP4, ZIP, JS/TS, EXE, unknown extension, no extension,
  `application/octet-stream`, 0-byte rejection, sparse 100 MB + 1 KB rejection (`413`),
  filename preservation and byte-identical downloads.
- **Sharing:** multiple files per request, unique tokens, metadata without internal paths or
  delete tokens, 404 for unknown tokens, recent uploads (and that they never expose delete
  tokens).
- **Deletion:** delete token ≠ share token, only the hash is stored, invalid/share tokens
  rejected, file and row removed, share link 404 afterwards, repeated deletion handled.
- **One-time downloads:** deletion only after a completed transfer, metadata reads keeping the
  file, an interrupted 8 MB download keeping it, a storage failure retaining the row as
  `pending_delete` with a successful retry, and three simultaneous downloads all receiving the
  full 2 MB payload with a single deletion and a subsequent `404`.
- **Expiry:** 1, 5 and 45 minutes, legacy presets, rejection of 0/negative/decimal/>10080
  values, immediate `410` after expiry, and physical deletion during cleanup.
- **Hardening:** CORS origin filtering, JSON 404s, empty upload rejection.
