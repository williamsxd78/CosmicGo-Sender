<#
  gen-self-signed-cert.ps1
  ------------------------
  Generates a *test-only* self-signed code-signing certificate so you can
  practice the signing pipeline locally. Windows will still warn users about
  untrusted publishers — only real OV/EV certs from a trusted CA remove the
  SmartScreen warning.

  Usage (elevated PowerShell recommended):
      PS> .\scripts\gen-self-signed-cert.ps1 -Password "test-password"

  Outputs:
      build\code-signing-test.pfx    — the certificate (do NOT commit)

  After running:
      $env:CSC_LINK        = "$PWD\build\code-signing-test.pfx"
      $env:CSC_KEY_PASSWORD = "test-password"
      .\scripts\build-windows.ps1
#>

param(
  [Parameter(Mandatory=$true)][string]$Password,
  [string]$Subject = "CN=Cosmic Sender Test, O=Cosmic Sender, C=US",
  [string]$OutFile = "build\code-signing-test.pfx"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Generating self-signed code-signing certificate..." -ForegroundColor Cyan
$cert = New-SelfSignedCertificate `
  -Subject $Subject `
  -Type CodeSigningCert `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyUsage DigitalSignature `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(3) `
  -FriendlyName "Cosmic Sender (test)"

$secure = ConvertTo-SecureString -String $Password -AsPlainText -Force
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null
Export-PfxCertificate -Cert $cert -FilePath $OutFile -Password $secure | Out-Null

Write-Host ""
Write-Host "Certificate written to: $OutFile" -ForegroundColor Green
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host ""
Write-Host "To sign the next build, set these environment variables and run build-windows.ps1:"
Write-Host "  `$env:CSC_LINK         = `"$PWD\$OutFile`""
Write-Host "  `$env:CSC_KEY_PASSWORD = `"<the password>`""
