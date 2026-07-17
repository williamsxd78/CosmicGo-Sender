@echo off
REM build-windows.cmd — Convenience wrapper around scripts\build-windows.ps1
REM
REM Usage:
REM   set CSC_LINK=C:\certs\code.pfx
REM   set CSC_KEY_PASSWORD=your-password
REM   scripts\build-windows.cmd
REM
REM Both env vars are OPTIONAL. If unset, the build proceeds unsigned.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows.ps1"
exit /b %errorlevel%
