# Building Cosmic Sender

## Windows (recommended)

On a Windows 10/11 machine with Node.js 20+ installed:

```powershell
git clone <repo>
cd cosmic-sender
npm install
npm run dist
```

Output (in `release/`):

- **CosmicSender-Setup-1.0.0.exe** — NSIS installer with a fully functional uninstaller, Start Menu / Desktop shortcuts, and Add/Remove Programs entry.
- **CosmicSender-Portable-1.0.0.exe** — single-file portable executable. No install required — just run.

Application data is stored under `%APPDATA%\CosmicSender\` regardless of installer type.

## macOS or x86_64 Linux (cross-compile)

```bash
npm install
npm run dist
```

`electron-builder` uses Wine to run the bundled NSIS toolchain and produces both artifacts identically to the Windows build.

## ARM64 Linux (cross-compile — used for this initial build)

ARM64 Linux hosts cannot execute the bundled x86_64 NSIS toolchain, and Wine on ARM64 cannot run 32-bit Windows binaries. The included helper `scripts/patch-electron-builder-arm64.js` works around both:

1. Requires `nsis` and `wine` from the OS package manager.
2. Symlinks the OS's ARM64 `makensis` into electron-builder's cache.
3. Patches `NsisTarget.js` so that if wine cannot execute the uninstaller stub, the build falls back to copying the installer stub as a placeholder.

Under this mode the installer works normally for installation, but the auto-generated uninstaller inside `CosmicSender-Setup-*.exe` will be a placeholder. To ship a full-featured NSIS installer with a working uninstaller, re-run `npm run dist` on Windows (or any x86_64 host) — the source, config, and dependencies are unchanged.

The **portable** `.exe` is produced fully functional on ARM64 as well.

## Prerequisites for this repository (Linux)

```bash
sudo apt-get install nsis wine imagemagick
```

## Running in development

```bash
npm install
npm run dev
```

This starts Vite for the renderer, watches TS for the main / preload processes, and launches Electron once both are ready.

## Testing

```bash
npm test           # Vitest unit tests (personalization, schemas, masking)
```

## App data & credentials

- SQLite database: `%APPDATA%\CosmicSender\cosmic-sender.db`
- SMTP passwords: Windows Credential Manager (via `keytar`, service name `CosmicSender`)
- Fallback (non-Windows / no libsecret): AES-256-GCM encrypted vault next to the DB.
