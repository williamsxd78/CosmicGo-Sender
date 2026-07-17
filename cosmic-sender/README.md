# Cosmic Sender

A premium, secure desktop application for sending **opt-in, transactional, and other authorized email**. Built with Electron, React, TypeScript, SQLite, Nodemailer, and Tailwind CSS.

Cosmic Sender is designed for **personal and authorized business email use**. It does **not** include list scraping, purchased-list collection, CAPTCHA bypass, spam-filter evasion, header spoofing, or domain impersonation. Only send email to recipients who have opted in.

## Highlights

- Windows installer (NSIS) and portable `.exe` targets
- Local encrypted SQLite database, WAL journaling
- Passwords stored in **Windows Credential Manager** (via `keytar`); encrypted vault fallback when unavailable
- Local admin password hashed with **Argon2id**
- Amazon SES SMTP + Standard/Gmail/M365/Zoho/SendGrid/Mailgun/Custom SMTP
- Connection testing with human-readable diagnostics (DNS, TLS, auth, relay, sender)
- Composer with personalization variables and fallbacks (`{first_name|there}`)
- Desktop / mobile / plain-text preview
- CSV importer with column mapping, dedup, suppression
- Templates, lists, suppression list (with import/export)
- Reliable send queue with pause / resume / cancel / retry
- Rate limiting per minute and per day
- Exponential backoff for retries (1m → 5m → 15m → 1h)
- Recipient-level status, message IDs, SMTP responses
- Export campaign report as CSV or JSON (credentials never included)
- Activity log + technical log with automatic secret masking
- Dark / light themes, tray icon, auto-lock

## Requirements

- Node.js 20+ and npm/yarn for building
- Windows 10/11 for the final installer target (portable exe runs on any Windows x64)

## Development

```bash
npm install
npm run dev          # Vite + Electron in development
npm run test         # Vitest unit tests
npm run build        # Compile main + preload + renderer
npm run dist         # Windows NSIS installer + Portable exe
```

`npm run dist` produces:

- `release/CosmicSender-Setup-<version>.exe` — NSIS installer
- `release/CosmicSender-Portable-<version>.exe` — portable single-file executable

Both are x64 by default. Data is stored under `%APPDATA%/CosmicSender/` on Windows.

## First-run setup wizard

1. Create a local admin password (Argon2id-hashed)
2. Choose theme
3. Add first SMTP provider
4. Test the provider
5. Add a verified sender identity
6. Send a test email
7. Open the dashboard

## Architecture

```
src/
├─ main/          Electron main process (Node): DB, queue, SMTP, IPC, credentials, migrations
├─ preload/       Context-isolated preload bridge exposing `window.cosmic`
├─ renderer/      React + Tailwind UI (Vite)
└─ shared/        Zod schemas, ipc channel names, personalization, secret masking
migrations/       SQL migrations (bundled as extraResources)
tests/            Vitest unit tests
build/            Icons / installer resources
```

Security posture:

- Electron uses `contextIsolation: true`, `nodeIntegration: false`, and a strict Content-Security-Policy in the renderer
- All IPC calls are pre-declared and validated with Zod
- SMTP passwords live in `keytar`, referenced from SQLite by an opaque `credential_ref`
- HTML previews render in a sandboxed iframe with `default-src 'none'`
- Attachments are validated (size, blocklist), and executable extensions are rejected

## Important functional rules

1. Never store SMTP passwords in plain text.
2. Never reveal passwords after saving.
3. Never place SMTP credentials in frontend code.
4. Never log SMTP passwords or API keys.
5. Never silently exceed provider rate limits.
6. Never resend successful recipients after restarting.
7. Never send to suppressed recipients.
8. Never label SMTP acceptance as confirmed delivery. Use "Accepted by SMTP" until a real provider webhook confirms delivery.
9. Never automatically start an overdue scheduled campaign.
10. Never allow arbitrary sender-header spoofing.

## License

MIT
