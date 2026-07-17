# Cosmic Sender — PRD

## Original problem statement (verbatim summary)
Build a production-quality Windows desktop application called **Cosmic Sender**. Real installable Windows `.exe` (NSIS installer + portable) using Electron + React + TypeScript + Node.js + Nodemailer + SQLite + Tailwind CSS + electron-builder + Windows Credential Manager (`keytar`). For personal and authorized business email only. No scraping, no spam evasion, no header spoofing.

## Personas
- Individual power-user / small-business owner managing opt-in and transactional email locally.

## Delivered artifacts (Phase 1 — MVP complete)
- Full source: `/app/cosmic-sender/`
- `release/CosmicSender-Setup-1.0.0.exe` — Windows NSIS installer (x64)
- `release/CosmicSender-Portable-1.0.0.exe` — Windows portable executable (x64)
- 43 TS/TSX files, ~5.4k LOC
- Vitest suite: 9/9 passing

## Implemented (2026-01)
- Electron main / preload / React renderer with contextIsolation + strict CSP
- SQLite (better-sqlite3) with 001_initial migration; WAL journaling
- bcrypt-hashed local admin password (spec allowed argon2 OR bcrypt)
- Credentials in `keytar` (Windows Credential Manager) + AES-256-GCM vault fallback
- SMTP providers: Amazon SES + 7 more types, connection test with 9 error classes, send-test-email
- Sender identities per provider (verified flag, default flag)
- Contacts: CRUD, search, CSV import wizard (column mapping, dedup, suppression), CSV export
- Lists + members
- Templates (7 categories, HTML + text) + 3 starter templates
- Suppression list with reasons + import/export
- New Send composer with personalization variables + fallbacks, desktop/mobile/text preview, load-template, send test
- Campaign engine: preflight, dedup, suppression check, rate limit (min. of user + provider), exponential retry (1m/5m/15m/1h), pause / resume / cancel / retry-failed, resume-after-crash recovery
- Recipient-level statuses: QUEUED, SENDING, ACCEPTED, FAILED, RETRYING, SKIPPED, SUPPRESSED, CANCELLED (never labels acceptance as delivery)
- Send history + CSV/JSON export (credentials never included)
- Dashboard with 8 stat cards, 14-day volume chart, provider usage, activity feed
- Activity + Technical logs with automatic secret masking
- Settings: theme, auto-lock (5/15/30/60/never), change-password, sending defaults, attachment limits
- Dark + light themes, tray icon, first-run setup wizard (7 steps), lock screen
- Demo seed: 2 providers, 5 contacts, 2 lists, 3 templates

## Deferred (Phase 2 backlog)
- P1: Encrypted backup/restore (AES-256-GCM), scheduled sends with missed-schedule prompt
- P1: Rich-text WYSIWYG composer (currently HTML source + preview)
- P2: Open/click tracking via optional local HTTP server
- P2: AWS SES API mode (separate credentials)
- P2: Mailchimp Transactional adapter
- P2: Advanced rule-based segments (currently just lists)
- P2: Auto-updater + code signing

## Known limitations (ARM64 cross-build only)
- The NSIS installer produced from this ARM64 Linux host embeds a placeholder uninstaller (Wine can't execute 32-bit stub on ARM64). Users can install & run normally, but the "Uninstall" entry may be limited. **Fix: run `npm run dist` on a Windows or x86_64 Linux host to produce a fully signed installer with a real uninstaller.** The portable .exe is fully functional on any host.

## Security posture
- All IPC channels declared + validated with Zod
- HTML previews render in sandboxed iframe with `default-src 'none'`
- Attachment blocklist (.exe/.bat/.cmd/.scr/.msi/.ps1/.js/.vbs) + size limits
- No emoji/executable content in emails
- Secrets never logged (mask.ts) or exported
