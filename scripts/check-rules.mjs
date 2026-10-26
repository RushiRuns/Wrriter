import fs from 'node:fs';
import path from 'node:path';

const violations = [];

const SYNC_FS_CALLS = [
  'readFileSync',
  'writeFileSync',
  'appendFileSync',
  'copyFileSync',
  'unlinkSync',
  'renameSync',
  'mkdirSync',
  'rmdirSync',
  'rmSync',
  'readdirSync',
  'statSync',
  'lstatSync',
  'accessSync'
];

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(full);
    }
  }
  return results;
}

function checkFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const isShared = normalizedPath.includes('/src/shared/');
  const isRenderer = normalizedPath.includes('/src/renderer/');
  const isMain = normalizedPath.includes('/src/main/');
  const isPreload = normalizedPath.includes('/src/preload/');

  // Ignore test scripts in main (e.g. test-day-one-sqlite.ts)
  const isTestOrStartup = normalizedPath.includes('test-day-one');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

    // 1. Layer Import Rules (ARCHITECTURE.md)
    const importMatch = lineText.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const target = importMatch[1];

      if (isShared) {
        if (
          target.startsWith('node:') ||
          ['fs', 'path', 'crypto', 'child_process', 'electron', 'react'].includes(target)
        ) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'shared-no-node-electron',
            message: `src/shared cannot import Node, Electron, or DOM: "${target}"`
          });
        }
        if (
          target.includes('/main') ||
          target.includes('/workers') ||
          target.includes('/preload') ||
          target.includes('/renderer') ||
          target.startsWith('@main') ||
          target.startsWith('@renderer')
        ) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'shared-layer-isolation',
            message: `src/shared cannot import from other layers: "${target}"`
          });
        }
      }

      if (isRenderer) {
        if (
          target.startsWith('node:') ||
          ['fs', 'path', 'crypto', 'child_process', 'electron'].includes(target)
        ) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'renderer-no-node-electron',
            message: `src/renderer cannot import Node or Electron: "${target}"`
          });
        }
        if (
          target.includes('/main') ||
          target.includes('/workers') ||
          target.includes('/preload') ||
          target.startsWith('@main')
        ) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'renderer-layer-isolation',
            message: `src/renderer cannot import from main/workers/preload: "${target}"`
          });
        }
      }

      if (isPreload) {
        if (
          target.includes('/main') ||
          target.includes('/workers') ||
          target.includes('/renderer') ||
          target.startsWith('@main') ||
          target.startsWith('@renderer')
        ) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'preload-layer-isolation',
            message: `src/preload cannot import from main/workers/renderer: "${target}"`
          });
        }
      }

      if (isMain) {
        if (target.includes('/renderer') || target.startsWith('@renderer')) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'main-no-renderer',
            message: `src/main cannot import from src/renderer: "${target}"`
          });
        }
      }
    }

    // 2. No Synchronous File I/O in Main (ARCHITECTURE.md rule 20)
    if (isMain && !isTestOrStartup) {
      for (const method of SYNC_FS_CALLS) {
        const regex = new RegExp(`\\b${method}\\b`);
        if (regex.test(lineText)) {
          violations.push({
            file: normalizedPath,
            line: lineNum,
            rule: 'no-sync-file-io',
            message: `Forbidden synchronous fs call in main process: ${method}`
          });
        }
      }
    }

    // 3. No Floating Promises (heuristic check for un-awaited and un-caught promise invocations)
    // Checks standalone invoke / async calls not prefixed by await, void, return, or const/let assignment
    if (
      (trimmed.startsWith('invoke(') || trimmed.startsWith('window.wrriter.')) &&
      !trimmed.startsWith('await ') &&
      !trimmed.startsWith('return ') &&
      !trimmed.startsWith('void ')
    ) {
      violations.push({
        file: normalizedPath,
        line: lineNum,
        rule: 'no-floating-promises',
        message: `Potential floating promise statement: "${trimmed}"`
      });
    }
  });
}

function run() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = collectFiles(srcDir);

  for (const f of files) {
    checkFile(f);
  }

  if (violations.length > 0) {
    console.error(`\n❌ Found ${violations.length} architectural rule violation(s):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.message}`);
    }
    process.exit(1);
  } else {
    console.log(`\n✔ All architectural build checks passed! Checked ${files.length} files across all layers with 0 violations.`);
  }
}

run();
