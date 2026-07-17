#!/usr/bin/env node
/**
 * patch-electron-builder-arm64.js
 *
 * When cross-building a Windows NSIS installer from an ARM64 Linux host, the
 * bundled `makensis.exe` cannot run and wine cannot execute the 32-bit
 * uninstaller stub. This patch:
 *   1. Symlinks the OS's `makensis` (arm64 native) into electron-builder's cache.
 *   2. Makes the uninstaller extraction step non-fatal, so the installer can
 *      still be produced (with a placeholder uninstaller that gets replaced
 *      properly when the same project is later built on a Windows/x64 host).
 *
 * Only run this on Linux ARM64 hosts. On Windows or x86_64 Linux the standard
 * `npm run dist` produces a fully-functional installer with a real uninstaller.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

if (process.platform !== 'linux' || process.arch !== 'arm64') {
  console.log('[patch] Skipping: only needed on linux/arm64.');
  process.exit(0);
}

// 1. Ensure system makensis exists
try {
  execSync('command -v makensis', { stdio: 'ignore' });
} catch {
  console.error('[patch] makensis is not installed. Run: sudo apt-get install nsis');
  process.exit(1);
}

// 2. Replace bundled makensis with symlink to system one
const cache = path.join(process.env.HOME || '/root', '.cache/electron-builder/nsis');
if (fs.existsSync(cache)) {
  for (const dir of fs.readdirSync(cache)) {
    const linuxDir = path.join(cache, dir, 'linux');
    const bin = path.join(linuxDir, 'makensis');
    if (fs.existsSync(linuxDir) && fs.existsSync(bin)) {
      const stat = fs.lstatSync(bin);
      if (!stat.isSymbolicLink()) {
        fs.renameSync(bin, bin + '.orig');
        fs.symlinkSync('/usr/bin/makensis', bin);
        console.log('[patch] symlinked', bin, '-> /usr/bin/makensis');
      }
    }
  }
}

// 3. Patch NsisTarget.js to make wine uninstaller extraction non-fatal
const nsisTarget = path.join(__dirname, '..', 'node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');
if (fs.existsSync(nsisTarget)) {
  let src = fs.readFileSync(nsisTarget, 'utf8');
  const needle = 'await (0, wine_1.execWine)(installerPath, null, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });';
  if (src.includes(needle)) {
    src = src.replace(
      needle,
      `try { ${needle} } catch (e) { builder_util_1.log.warn({ reason: e.message }, "wine uninstaller extraction skipped (arm64 cross-build)"); const fs = require("fs"); fs.copyFileSync(installerPath, uninstallerPath); }`,
    );
    fs.writeFileSync(nsisTarget, src);
    console.log('[patch] patched NsisTarget.js to tolerate wine failure on arm64');
  } else {
    console.log('[patch] NsisTarget.js already patched or upstream changed.');
  }
}

console.log('[patch] done.');
