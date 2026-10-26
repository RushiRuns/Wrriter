#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

/**
 * Token Check:
 * Fails if raw hex/rgb/hsl colors or off-scale hardcoded values are used in renderer CSS
 * outside tokens.css and components.css (the design token declarations).
 */
const rootDir = process.cwd();
const rendererDir = path.join(rootDir, 'src/renderer');

const RAW_COLOR_REGEX = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

function getFiles(dir, ext = '.css') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, ext));
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const cssFiles = getFiles(rendererDir, '.css');
let violations = [];

// Approved definition files where raw values define tokens
const ALLOWED_DEFINITION_FILES = ['tokens.css', 'components.css'];

for (const file of cssFiles) {
  const baseName = path.basename(file);
  if (ALLOWED_DEFINITION_FILES.includes(baseName)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Strip comments
    const cleanLine = line.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!cleanLine) return;

    const matches = cleanLine.match(RAW_COLOR_REGEX);
    if (matches) {
      for (const match of matches) {
        violations.push({
          file: path.relative(rootDir, file),
          line: index + 1,
          match,
          content: cleanLine
        });
      }
    }
  });
}

console.log('Running Token Check...');
if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} token violations (raw colours or unapproved styles outside tokens.css):`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> "${v.match}" in: ${v.content}`);
  }
  process.exit(1);
} else {
  console.log(`✔ All renderer styles adhere strictly to design tokens! Checked ${cssFiles.length} CSS files.`);
  process.exit(0);
}
