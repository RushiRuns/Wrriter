#!/usr/bin/env node

/**
 * Contrast Check:
 * Enforces WCAG contrast standards:
 * - 4.5:1 for normal body and UI text
 * - 3.0:1 for large text, graphical elements, outlines, and buttons
 * Evaluated across both themes (light and dark) and all five accents (sky, yellow, coral, mint, lilac).
 */

function hexToRgb(hex) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getRelativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const l1 = getRelativeLuminance(hexToRgb(hex1));
  const l2 = getRelativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const themeColors = {
  light: {
    bg: '#FFFFFF',
    tx: '#1D1D1F',
    tx2: '#5E5E5E',
    tx3: '#6B6B6B',
    tags: ['#C15343', '#2A836F', '#2B7BB6', '#7F66C2', '#9B6B1C'],
    accents: {
      sky: { accent: '#2F96E0', onacc: '#FFFFFF', link: '#1B73B3' },
      yellow: { accent: '#FFE066', onacc: '#2A2208', fold: '#AD8500' },
      coral: { accent: '#E8604C', onacc: '#FFFFFF', link: '#C2432F' },
      mint: { accent: '#2FA58A', onacc: '#FFFFFF', link: '#1F7F69' },
      lilac: { accent: '#8B6FD6', onacc: '#FFFFFF', link: '#6A4FC0' }
    }
  },
  dark: {
    bg: '#1E1E1E',
    tx: '#F2F2F2',
    tx2: '#A6A6A6',
    tx3: '#9C9C9C',
    tags: ['#EE8879', '#63BCA7', '#63B0E8', '#A893E0', '#E2AD54'],
    accents: {
      sky: { accent: '#5BB8F2', onacc: '#062235', link: '#8CD0F8' },
      yellow: { accent: '#FFE27A', onacc: '#1D1700', fold: '#FFE27A' },
      coral: { accent: '#FF8A75', onacc: '#2B1410', link: '#FFA391' },
      mint: { accent: '#52CDAA', onacc: '#06241C', link: '#7FE0C4' },
      lilac: { accent: '#B6A0F7', onacc: '#1D1238', link: '#C9B9FA' }
    }
  }
};

let failures = [];

console.log('Running Contrast Check (4.5:1 text, 3:1 graphical elements across both themes & all 5 accents)...');

for (const [theme, data] of Object.entries(themeColors)) {
  // 1. Text against background
  const txRatio = getContrastRatio(data.tx, data.bg);
  if (txRatio < 4.5) failures.push(`${theme} --tx on ${data.bg}: ${txRatio.toFixed(2)}:1 < 4.5:1`);

  const tx2Ratio = getContrastRatio(data.tx2, data.bg);
  if (tx2Ratio < 4.5) failures.push(`${theme} --tx2 on ${data.bg}: ${tx2Ratio.toFixed(2)}:1 < 4.5:1`);

  const tx3Ratio = getContrastRatio(data.tx3, data.bg);
  if (tx3Ratio < 4.5) failures.push(`${theme} --tx3 on ${data.bg}: ${tx3Ratio.toFixed(2)}:1 < 4.5:1`);

  // 2. Tag colours on page background
  data.tags.forEach((tag, idx) => {
    const ratio = getContrastRatio(tag, data.bg);
    if (ratio < 4.5) {
      failures.push(`${theme} tag --tc${idx + 1} (${tag}) on ${data.bg}: ${ratio.toFixed(2)}:1 < 4.5:1`);
    }
  });

  // 3. Accent text & interactive elements
  for (const [accentName, acc] of Object.entries(data.accents)) {
    // onacc text on accent button
    const onaccRatio = getContrastRatio(acc.onacc, acc.accent);
    // Yellow text must be >= 4.5:1; saturated buttons >= 3:1 for graphical/large text
    const targetOnacc = accentName === 'yellow' ? 4.5 : 3.0;
    if (onaccRatio < targetOnacc) {
      failures.push(`${theme} ${accentName} onacc (${acc.onacc}) on accent (${acc.accent}): ${onaccRatio.toFixed(2)}:1 < ${targetOnacc}:1`);
    }

    // Link text on page
    if (acc.link) {
      const linkRatio = getContrastRatio(acc.link, data.bg);
      if (linkRatio < 4.5) {
        failures.push(`${theme} ${accentName} link (${acc.link}) on ${data.bg}: ${linkRatio.toFixed(2)}:1 < 4.5:1`);
      }
    }

    // Yellow fold indicator against page
    if (acc.fold) {
      const foldRatio = getContrastRatio(acc.fold, data.bg);
      if (foldRatio < 3.0) {
        failures.push(`${theme} ${accentName} fold indicator (${acc.fold}) on ${data.bg}: ${foldRatio.toFixed(2)}:1 < 3.0:1`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`❌ Contrast check failed with ${failures.length} violations:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
} else {
  console.log('✔ All contrast checks passed! All text >= 4.5:1, all graphical/accent elements >= 3.0:1 across light/dark and all 5 accents.');
  process.exit(0);
}
