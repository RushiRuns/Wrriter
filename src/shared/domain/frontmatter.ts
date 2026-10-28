export interface FrontmatterResult {
  readonly hasFrontmatter: boolean;
  readonly isBroken: boolean;
  readonly raw: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly tagsForm: 'flow' | 'list';
  readonly status: string | null;
  readonly created: string | null;
  readonly unownedKeys: ReadonlyMap<string, string>;
}

export interface FrontmatterUpdates {
  readonly tags?: readonly string[] | undefined;
  readonly status?: string | null | undefined;
  readonly created?: string | null | undefined;
}

/**
 * Formats a creation date timestamp in ISO-8601 (YYYY-MM-DDTHH:mm:ss).
 * Clean, standard, sorts chronologically in SQLite, portable across markdown tools.
 */
export function formatCreatedDate(d: Date | number = new Date()): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Parses frontmatter block from note source.
 */
export function parseFrontmatter(source: string): FrontmatterResult {
  if (!source.startsWith('---')) {
    return {
      hasFrontmatter: false,
      isBroken: false,
      raw: '',
      body: source,
      tags: [],
      tagsForm: 'flow',
      status: null,
      created: null,
      unownedKeys: new Map()
    };
  }

  // Find closing --- line
  const lines = source.split(/\r?\n/);
  const firstLine = lines[0];
  if (firstLine !== '---') {
    return {
      hasFrontmatter: false,
      isBroken: false,
      raw: '',
      body: source,
      tags: [],
      tagsForm: 'flow',
      status: null,
      created: null,
      unownedKeys: new Map()
    };
  }

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === '---' || l === '...') {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    // Unclosed frontmatter is treated as broken
    return {
      hasFrontmatter: true,
      isBroken: true,
      raw: source,
      body: '',
      tags: [],
      tagsForm: 'flow',
      status: null,
      created: null,
      unownedKeys: new Map()
    };
  }

  const fmLines = lines.slice(1, closeIdx);
  const raw = lines.slice(0, closeIdx + 1).join('\n') + '\n';
  const body = lines.slice(closeIdx + 1).join('\n');

  // Parse fields
  let isBroken = false;
  let status: string | null = null;
  let created: string | null = null;
  let tags: string[] = [];
  let tagsForm: 'flow' | 'list' = 'flow';
  const unowned = new Map<string, string>();

  let i = 0;
  while (i < fmLines.length) {
    const line = fmLines[i];
    if (line === undefined) break;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // Check for broken syntax such as unclosed bracket or multiple colons without quotes
    if (trimmed.includes('[') && !trimmed.includes(']')) {
      isBroken = true;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      isBroken = true;
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const valPart = line.slice(colonIdx + 1).trim();

    if (key === 'tags') {
      if (valPart.startsWith('[') && valPart.endsWith(']')) {
        tagsForm = 'flow';
        const inner = valPart.slice(1, -1).trim();
        if (inner.length > 0) {
          tags = inner
            .split(',')
            .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter((t) => t.length > 0);
        }
        i++;
      } else if (valPart === '') {
        // List form: read following indented lines starting with -
        tagsForm = 'list';
        i++;
        while (i < fmLines.length) {
          const nextLine = fmLines[i];
          if (nextLine === undefined) break;
          const match = nextLine.match(/^[ \t]+-[ \t]+(.*)$/);
          if (match && match[1]) {
            tags.push(match[1].trim().replace(/^['"]|['"]$/g, ''));
            i++;
          } else {
            break;
          }
        }
      } else {
        // Single tag or invalid flow
        tags = [valPart.replace(/^['"]|['"]$/g, '')];
        i++;
      }
    } else if (key === 'status') {
      status = valPart.replace(/^['"]|['"]$/g, '') || null;
      i++;
    } else if (key === 'created') {
      created = valPart.replace(/^['"]|['"]$/g, '') || null;
      i++;
    } else {
      // Unowned key: store value (multi-line or single-line)
      let val = valPart;
      i++;
      while (i < fmLines.length) {
        const nextLine = fmLines[i];
        if (nextLine === undefined) break;
        if (/^[ \t]+/.test(nextLine)) {
          val += '\n' + nextLine;
          i++;
        } else {
          break;
        }
      }
      unowned.set(key, val);
    }
  }

  if (isBroken) {
    return {
      hasFrontmatter: true,
      isBroken: true,
      raw,
      body,
      tags: [],
      tagsForm,
      status: null,
      created: null,
      unownedKeys: unowned
    };
  }

  return {
    hasFrontmatter: true,
    isBroken: false,
    raw,
    body,
    tags,
    tagsForm,
    status,
    created,
    unownedKeys: unowned
  };
}

/**
 * Surgically updates owned frontmatter keys while keeping all comments,
 * unowned keys, key order, and indentation 100% byte-for-byte identical.
 */
export function updateFrontmatter(source: string, updates: FrontmatterUpdates): string {
  const parsed = parseFrontmatter(source);

  // If broken frontmatter, SCHEMA.md mandates: file is left untouched
  if (parsed.isBroken) {
    return source;
  }

  // Detect line ending
  const isCrlf = source.includes('\r\n');
  const eol = isCrlf ? '\r\n' : '\n';

  if (!parsed.hasFrontmatter) {
    // If no frontmatter and nothing to add, return source
    const hasAnyUpdate =
      (updates.tags && updates.tags.length > 0) ||
      (updates.status && updates.status.length > 0) ||
      (updates.created && updates.created.length > 0);

    if (!hasAnyUpdate) return source;

    const newLines: string[] = ['---'];
    if (updates.tags && updates.tags.length > 0) {
      newLines.push('tags:');
      for (const t of updates.tags) {
        newLines.push(`  - ${t}`);
      }
    }
    if (updates.status) {
      newLines.push(`status: ${updates.status}`);
    }
    if (updates.created) {
      newLines.push(`created: ${updates.created}`);
    }
    newLines.push('---');
    return newLines.join(eol) + eol + source;
  }

  // Update existing frontmatter lines
  const lines = source.split(/\r?\n/);
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === '---' || l === '...') {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) return source;

  const fmLines = lines.slice(1, closeIdx);
  const remainingLines = lines.slice(closeIdx);

  // 1. Update status
  if (updates.status !== undefined) {
    let found = false;
    for (let i = 0; i < fmLines.length; i++) {
      const l = fmLines[i];
      if (l && /^[ \t]*status[ \t]*:/.test(l)) {
        found = true;
        if (updates.status === null) {
          fmLines.splice(i, 1);
        } else {
          fmLines[i] = `status: ${updates.status}`;
        }
        break;
      }
    }
    if (!found && updates.status !== null) {
      fmLines.push(`status: ${updates.status}`);
    }
  }

  // 2. Update created
  if (updates.created !== undefined) {
    let found = false;
    for (let i = 0; i < fmLines.length; i++) {
      const l = fmLines[i];
      if (l && /^[ \t]*created[ \t]*:/.test(l)) {
        found = true;
        if (updates.created === null) {
          fmLines.splice(i, 1);
        } else {
          fmLines[i] = `created: ${updates.created}`;
        }
        break;
      }
    }
    if (!found && updates.created !== null) {
      fmLines.push(`created: ${updates.created}`);
    }
  }

  // 3. Update tags
  if (updates.tags !== undefined) {
    let tagsIdx = -1;
    let isFlow = true;

    for (let i = 0; i < fmLines.length; i++) {
      const l = fmLines[i];
      if (l && /^[ \t]*tags[ \t]*:/.test(l)) {
        tagsIdx = i;
        isFlow = l.includes('[');
        break;
      }
    }

    if (tagsIdx !== -1) {
      if (isFlow) {
        // Flow format: tags: [a, b]
        fmLines[tagsIdx] = `tags: [${updates.tags.join(', ')}]`;
      } else {
        // List format: remove existing list lines under tags
        let endListIdx = tagsIdx + 1;
        while (endListIdx < fmLines.length) {
          const l = fmLines[endListIdx];
          if (l && /^[ \t]+-[ \t]+/.test(l)) {
            endListIdx++;
          } else {
            break;
          }
        }
        const newTagLines = updates.tags.map((t) => `  - ${t}`);
        fmLines.splice(tagsIdx + 1, endListIdx - (tagsIdx + 1), ...newTagLines);
      }
    } else if (updates.tags.length > 0) {
      // Tags not present: insert list tags (SCHEMA.md: A new key uses the list form)
      fmLines.push('tags:');
      for (const t of updates.tags) {
        fmLines.push(`  - ${t}`);
      }
    }
  }

  const resultLines = ['---', ...fmLines, ...remainingLines];
  return resultLines.join(eol);
}
