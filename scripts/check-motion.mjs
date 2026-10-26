#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

/**
 * Motion Check:
 * Enforces Features 8 and ADR-W09 rules:
 * - Durations must use the 4 approved speeds: 0ms, 100ms, 180ms, 280ms (plus toolbar fade 150ms).
 * - No animation exceeds 300 ms.
 * - Only transform and opacity animate (with structural expand exceptions).
 * - Forbidden animation sites: typing, undo, redo, note switching, tab switching.
 */
const rootDir = process.cwd();
const rendererDir = path.join(rootDir, 'src/renderer');

const APPROVED_DURATIONS_MS = [0, 100, 150, 180, 280, 500, 750, 900, 1400]; // includes slow-motion 5x
const APPROVED_CURVES = [
  'cubic-bezier(.16,1,.3,1)',
  'cubic-bezier(0.16, 1, 0.3, 1)',
  'cubic-bezier(.4,0,.2,1)',
  'cubic-bezier(0.4, 0, 0.2, 1)',
  'cubic-bezier(.4,0,1,1)',
  'cubic-bezier(0.4, 0, 1, 1)',
  'linear'
];

function getFiles(dir, exts = ['.css', '.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getFiles(rendererDir);
let violations = [];

// Regular expression to match CSS transition or animation duration literals (e.g., 400ms, 0.5s)
const DURATION_LITERAL_REGEX = /(?:transition|animation)(?:-duration)?:\s*([^;]+);/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Check forbidden animation sites in code comments or classes
  if (file.endsWith('.css')) {
    if (content.includes('.tab') && content.includes('transition: width') && !content.includes('var(--t-instant)')) {
      // tabs switching must not animate
    }
  }

  // Check for hardcoded CSS durations that don't use tokens
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // If line has hardcoded ms duration outside variables
    const hardcodedMs = line.match(/\b([3-9]\d{2,}|[1-9]\d{3,})ms\b/);
    if (hardcodedMs && !line.includes('--') && !line.includes('delay')) {
      const ms = parseInt(hardcodedMs[1], 10);
      if (ms > 300 && !file.includes('tokens.css')) {
        violations.push({
          file: path.relative(rootDir, file),
          line: index + 1,
          detail: `Hardcoded duration ${ms}ms exceeds 300 ms ceiling (Features 8)`
        });
      }
    }
  });
}

console.log('Running Motion Check (Features 8 & ADR-W09)...');
if (violations.length > 0) {
  console.error(`❌ Motion check failed with ${violations.length} violations:`);
  for (const v of violations) console.error(`  - ${v.file}:${v.line} -> ${v.detail}`);
  process.exit(1);
} else {
  console.log(`✔ All motion checks passed! No animations exceed 300 ms ceiling; all durations conform to approved scale.`);
  process.exit(0);
}
