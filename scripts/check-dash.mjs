#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

/**
 * Long-Dash Check:
 * Fails if an em-dash (— \u2014) or en-dash (– \u2013) is used in app user-facing text strings.
 * Wrriter uses simple hyphens (-) in all interface copy.
 */
const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

function getFiles(dir, exts = ['.ts', '.tsx', '.html']) {
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

const files = getFiles(srcDir);
let violations = [];

const LONG_DASH_REGEX = /[\u2013\u2014]/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Check if line contains em-dash or en-dash
    if (LONG_DASH_REGEX.test(line)) {
      violations.push({
        file: path.relative(rootDir, file),
        line: index + 1,
        content: line.trim()
      });
    }
  });
}

console.log('Running Long-Dash Check (no en-dash or em-dash in UI copy)...');
if (violations.length > 0) {
  console.error(`❌ Long-dash check failed with ${violations.length} violations:`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> "${v.content}"`);
  }
  process.exit(1);
} else {
  console.log(`✔ Long-dash check passed! Zero typographical long dashes found in src/ copy across ${files.length} source files.`);
  process.exit(0);
}
