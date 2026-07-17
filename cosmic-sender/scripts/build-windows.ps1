<#
  build-windows.ps1
  ------------------
  Builds Cosmic Sender on a Windows host.

  • Runs a clean install + TypeScript build + electron-builder for NSIS + portable.
  • Auto-detects code-signing credentials from environment variables:
        $env:CSC_LINK           = path (or base64) to .pfx / .p12 certificate
        $env:CSC_KEY_PASSWORD   = certificate password
    If either variable is empty, the build proceeds UNSIGNED (users will see a
    Windows SmartScreen warning). This is fine for internal / test use.
  • Timestamping is done via http://timestamp.digicert.com (configured in
    package.json) so signatures remain valid after cert expiry.

  Usage:
      PS> .\scripts\build-windows.ps1                    # unsigned build
      PS> $env:CSC_LINK        = "C:\certs\code.pfx"
      PS> $env:CSC_KEY_PASSWORD = "your-cert-password"
      PS> .\scripts\build-windows.ps1                    # signed build
#>

$ErrorActionPreference = 'Stop'

Write-Host "== Cosmic Sender — Windows build ==" -ForegroundColor Cyan

# 1. Node / npm sanity
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 20+ is required. Install from https://nodejs.org/"
}
$nodeVersion = (node --version).TrimStart('v')
if ([version]$nodeVersion -lt [version]'20.0.0') {
  Write-Error "Node.js $nodeVersion detected — please install 20.x or newer."
}

# 2. Move to project root
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "Working directory: $root"

# 3. Install dependencies
if (-not (Test-Path node_modules)) {
  Write-Host "Installing dependencies (this can take a few minutes)..." -ForegroundColor Yellow
  npm install
}

# 4. Detect code-signing config
if ($env:CSC_LINK -and $env:CSC_KEY_PASSWORD) {
  Write-Host "Code signing: ENABLED (CSC_LINK detected)" -ForegroundColor Green
} elseif ($env:WIN_CSC_LINK -and $env:WIN_CSC_KEY_PASSWORD) {
  Write-Host "Code signing: ENABLED (WIN_CSC_LINK detected)" -ForegroundColor Green
} else {
  Write-Host "Code signing: DISABLED (no CSC_LINK / WIN_CSC_LINK env var). Build will be unsigned." -ForegroundColor Yellow
  Write-Host "  To sign, set: `$env:CSC_LINK = 'path\\to\\cert.pfx'; `$env:CSC_KEY_PASSWORD = 'password'"
  # Explicitly disable to avoid any 'no cert found' errors from electron-builder
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}

# 5. Clean prior artifacts and build
Write-Host "Cleaning..." -ForegroundColor Cyan
npm run clean

Write-Host "Building renderer + main + preload..." -ForegroundColor Cyan
npm run build

# 6. Run electron-builder (fully-featured NSIS + portable)
Write-Host "Running electron-builder..." -ForegroundColor Cyan
npx electron-builder --win nsis portable --x64 --publish=never

# 7. Report
Write-Host ""
Write-Host "== Build complete ==" -ForegroundColor Green
Get-ChildItem -Path release -Filter "*.exe" -File | ForEach-Object {
  $sizeMB = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0}  ({1} MB)" -f $_.Name, $sizeMB)
}

Write-Host ""
Write-Host "Outputs in the 'release\' folder:"
Write-Host "  • CosmicSender-Setup-<version>.exe   — NSIS installer (full uninstaller included)"
Write-Host "  • CosmicSender-Portable-<version>.exe — single-file portable executable"
