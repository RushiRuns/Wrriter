import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAX_INSTALLER_MB = 120;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return { raw: 0, gzip: 0 };
  const content = fs.readFileSync(filePath);
  const gzip = zlib.gzipSync(content).length;
  return { raw: content.length, gzip };
}

function getDirTotalSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirTotalSize(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

export function generateSizeReport() {
  console.log('\n========================================');
  console.log('       WRRITER APP SIZE REPORT          ');
  console.log('========================================\n');

  const cwd = process.cwd();
  const outDir = path.join(cwd, 'out');
  const distDir = path.join(cwd, 'dist');
  const winUnpacked = path.join(distDir, 'win-unpacked');

  const bundleFiles = [
    { name: 'Main Process', path: path.join(outDir, 'main/index.js') },
    { name: 'Preload Bridge', path: path.join(outDir, 'preload/index.js') },
    { name: 'Index Worker', path: path.join(outDir, 'workers/index.js') },
    { name: 'Jobs Worker', path: path.join(outDir, 'workers/jobs.js') },
    { name: 'Renderer HTML', path: path.join(outDir, 'renderer/windows/main/index.html') }
  ];

  // Also check renderer assets
  const rendererAssetsDir = path.join(outDir, 'renderer/assets');
  if (fs.existsSync(rendererAssetsDir)) {
    const assetFiles = fs.readdirSync(rendererAssetsDir);
    for (const f of assetFiles) {
      bundleFiles.push({
        name: `Renderer Asset (${f})`,
        path: path.join(rendererAssetsDir, f)
      });
    }
  }

  console.log('📦 Production Bundles (out/):');
  console.log('------------------------------------------------------------');
  console.log(
    'Bundle Name'.padEnd(30) + 'Raw Size'.padEnd(16) + 'Gzip Size'.padEnd(14)
  );
  console.log('------------------------------------------------------------');

  let totalRaw = 0;
  let totalGzip = 0;

  for (const item of bundleFiles) {
    const { raw, gzip } = getFileSize(item.path);
    totalRaw += raw;
    totalGzip += gzip;
    console.log(
      item.name.padEnd(30) +
        formatBytes(raw).padEnd(16) +
        formatBytes(gzip).padEnd(14)
    );
  }

  console.log('------------------------------------------------------------');
  console.log(
    'TOTAL BUNDLE ASSETS'.padEnd(30) +
      formatBytes(totalRaw).padEnd(16) +
      formatBytes(totalGzip).padEnd(14)
  );
  console.log('\n');

  // Packaged app inspection
  if (fs.existsSync(distDir)) {
    console.log('🗜️  Packaged Artifacts (dist/):');
    console.log('------------------------------------------------------------');

    // Find any installer executable
    const files = fs.readdirSync(distDir);
    const installerExe = files.find(
      (f) => f.endsWith('.exe') && !f.includes('win-unpacked')
    );

    if (installerExe) {
      const installerPath = path.join(distDir, installerExe);
      const installerSize = fs.statSync(installerPath).size;
      const installerMB = installerSize / (1024 * 1024);
      console.log(`  - Installer (${installerExe}): ${formatBytes(installerSize)}`);

      if (installerMB > MAX_INSTALLER_MB) {
        console.error(
          `\n❌ INSTALLER SIZE VIOLATION: ${installerMB.toFixed(2)} MB exceeds ${MAX_INSTALLER_MB} MB limit!`
        );
        process.exit(1);
      } else {
        console.log(
          `✔ Installer Budget: ${installerMB.toFixed(2)} MB is within the ${MAX_INSTALLER_MB} MB ceiling.`
        );
      }
    } else if (fs.existsSync(winUnpacked)) {
      const totalUnpacked = getDirTotalSize(winUnpacked);
      const asarPath = path.join(winUnpacked, 'resources/app.asar');
      if (fs.existsSync(asarPath)) {
        console.log(`  - Packaged ASAR (app.asar): ${formatBytes(fs.statSync(asarPath).size)}`);
      }
      console.log(`  - Unpacked Application Directory: ${formatBytes(totalUnpacked)}`);
      console.log(
        `ℹ  Note: NSIS compressed installer target is < 120 MB (unpacked includes raw Chromium binaries).`
      );
    }
  }

  console.log('\n========================================\n');
}

if (process.argv[1]?.includes('size-report')) {
  generateSizeReport();
}
