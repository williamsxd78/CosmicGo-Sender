# Building Cosmic Sender

The distribution targets are:

| File | Purpose |
| --- | --- |
| `release\CosmicSender-Setup-<version>.exe` | NSIS installer (Start Menu / Desktop shortcuts, Add/Remove Programs entry, full uninstaller) |
| `release\CosmicSender-Portable-<version>.exe` | Single-file portable executable, no install required |

Application data is stored under `%APPDATA%\CosmicSender\`. SMTP credentials live only in **Windows Credential Manager** (via `keytar`), never in the SQLite DB.

---

## 1 · Building on Windows (recommended)

This is the only way to produce an installer with a **fully-functional embedded uninstaller** and a valid Authenticode signature.

### Prerequisites

- Windows 10 / 11 (x64)
- **Node.js 20 or newer** — <https://nodejs.org/>
- Git

### Fast path

```powershell
git clone <this-repo>
cd cosmic-sender
scripts\build-windows.cmd
```

or, from PowerShell:

```powershell
.\scripts\build-windows.ps1
```

The script:

1. Verifies Node.js ≥ 20.
2. Runs `npm install` (only on first run).
3. Runs unit tests → then Vite + TypeScript build → then `electron-builder`.
4. Auto-detects code-signing environment variables (see next section).
5. Prints the paths and sizes of the resulting `.exe` files.

### Direct npm command

```powershell
npm install
npm run dist         # builds NSIS + portable
npm run dist:nsis    # NSIS installer only
npm run dist:portable # portable only
```

---

## 2 · Code signing (required to avoid SmartScreen warnings)

electron-builder reads the signing certificate from environment variables at build time; no secrets are ever committed to the repo.

### Environment variables

| Variable | Meaning |
| --- | --- |
| `CSC_LINK` | Path to `.pfx` / `.p12` cert file **or** base64-encoded cert contents (CI-friendly) |
| `CSC_KEY_PASSWORD` | Password for the `.pfx` / `.p12` file |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | Windows-specific overrides (used if `CSC_*` are set for another platform) |
| `CSC_IDENTITY_AUTO_DISCOVERY=false` | Forces an unsigned build (auto-set by our scripts when no cert is present) |

Timestamping is done via `http://timestamp.digicert.com` (configured in `package.json` → `build.win.rfc3161TimeStampServer`) so signatures remain valid after certificate expiry.

### Signing a build locally

```powershell
$env:CSC_LINK        = "C:\certs\cosmic-sender-code-signing.pfx"
$env:CSC_KEY_PASSWORD = "…your cert password…"
.\scripts\build-windows.ps1
```

### Choosing a certificate

- **OV certificate** (Organization Validated, ~$180/yr) — signs the binary. Reduces SmartScreen warnings only after your app builds "reputation" (many downloads). Cheapest option.
- **EV certificate** (Extended Validation, ~$300–$500/yr) — signs the binary with a hardware token. **Instantly bypasses SmartScreen warnings** (no reputation needed). Recommended for public releases.
  Vendors: Sectigo, DigiCert, GlobalSign, SSL.com, Certum.

For EV certs on a hardware token you'll need the token's `.pfx` export or vendor-specific signing bridge (e.g. SafeNet Authentication Client). Configure the env vars accordingly.

### Testing the signing pipeline without buying a cert

Generate a *self-signed* test certificate:

```powershell
.\scripts\gen-self-signed-cert.ps1 -Password "test-password"
$env:CSC_LINK         = "$PWD\build\code-signing-test.pfx"
$env:CSC_KEY_PASSWORD = "test-password"
.\scripts\build-windows.ps1
```

The resulting exe will be signed, but Windows will still show SmartScreen ("Unknown publisher") until you install the certificate into the Trusted Publishers store on the test machine. This is expected — self-signed certs prove the pipeline works, not the identity.

---

## 3 · CI: automated signed builds via GitHub Actions

`.github\workflows\windows-build.yml` runs on Windows-2022 runners and can produce signed builds when the following repository **secrets** are configured:

- `CSC_LINK` — base64-encoded `.pfx` file contents
  ```bash
  # Encode locally:
  base64 -w0 cosmic-sender-code-signing.pfx | pbcopy
  ```
- `CSC_KEY_PASSWORD` — cert password

The workflow triggers on `git push --tags v<version>` and creates a draft GitHub Release with both `.exe` files attached. You can also run it manually via *Actions → windows-build → Run workflow*.

If the secrets are absent, the workflow still builds an unsigned exe and uploads it as an artifact (useful for internal / test builds).

---

## 4 · Building from macOS / x86_64 Linux (cross-compile)

electron-builder uses Wine to run the bundled NSIS toolchain on non-Windows hosts. This produces the exact same artifacts as a native Windows build, **but only if Wine can execute 32-bit Windows binaries** (i.e. host is amd64/x86_64 with `wine32:i386`). Cross-signing works if you set `CSC_LINK` / `CSC_KEY_PASSWORD` the same way.

```bash
sudo apt-get install nsis wine wine32:i386
npm install
npm run dist
```

---

## 5 · Building from ARM64 Linux (limitations)

The initial build in this repository was produced from an ARM64 Debian container. Because Wine on ARM64 cannot run 32-bit Windows stubs, the NSIS **uninstaller** in the ARM64-produced installer is a placeholder. Everything else — install, run, Add/Remove Programs entry — works, but the uninstall action itself may be limited on that specific build.

**To ship publicly, rebuild once on Windows or x86_64 Linux** using the steps above. Nothing else needs to change — same repo, same commit, same config.

The included `scripts/patch-electron-builder-arm64.js` is auto-invoked by `npm run dist` and is a no-op on all non-ARM64-Linux hosts.

---

## 6 · Verifying a signed build

After signing, verify with Windows built-in tools:

```powershell
Get-AuthenticodeSignature .\release\CosmicSender-Setup-1.0.0.exe

# Or from a signed cmd:
signtool verify /pa /v .\release\CosmicSender-Setup-1.0.0.exe
```

You should see `Status = Valid` and the signer / timestamp details.

---

## 7 · Running the app from source (development)

```powershell
npm install
npm run dev
```

Starts Vite (renderer), TypeScript watch (main / preload), and Electron once both are ready.

## 8 · Tests

```powershell
npm test       # Vitest — personalization, schemas, secret masking, validation
```
