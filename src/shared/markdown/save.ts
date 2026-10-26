import { blockSplitter, type MarkdownBlock } from './blocks';

export interface OriginalNoteDescriptor {
  readonly text: string;
  readonly lineEnding?: '\r\n' | '\n' | undefined;
  readonly hasBom?: boolean | undefined;
  readonly hasFinalNewline?: boolean | undefined;
}

export interface SavePlan {
  readonly unchanged: boolean;
  readonly text: string;
  readonly bytes: Uint8Array;
  readonly changedBlockCount: number;
  readonly lineEnding: '\r\n' | '\n';
  readonly hasBom: boolean;
  readonly hasFinalNewline: boolean;
}

// UTF-8 encode pure implementation to avoid DOM or Node dependencies
export function encodeUtf8(str: string): Uint8Array {
  // In modern JS runtimes (Node 18+, browsers), TextEncoder is global
  const globalObj = globalThis as unknown as { TextEncoder?: new () => { encode(s: string): Uint8Array } };
  if (typeof globalObj.TextEncoder === 'function') {
    return new globalObj.TextEncoder().encode(str);
  }
  // Fallback pure UTF-8 encoder
  const codePoints: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = ((c - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (c < 0x80) {
      codePoints.push(c);
    } else if (c < 0x800) {
      codePoints.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      codePoints.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      codePoints.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      );
    }
  }
  return new Uint8Array(codePoints);
}

export function decodeUtf8(bytes: Uint8Array): string {
  const globalObj = globalThis as unknown as { TextDecoder?: new () => { decode(b: Uint8Array): string } };
  if (typeof globalObj.TextDecoder === 'function') {
    return new globalObj.TextDecoder().decode(bytes);
  }
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 === undefined) break;
    if (b1 < 0x80) {
      out += String.fromCharCode(b1);
    } else if (b1 >> 5 === 0x06) {
      const b2 = bytes[i++];
      if (b2 !== undefined) out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 >> 4 === 0x0e) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      if (b2 !== undefined && b3 !== undefined) {
        out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
      }
    } else if (b1 >> 3 === 0x1e) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      if (b2 !== undefined && b3 !== undefined && b4 !== undefined) {
        let cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode((cp >> 10) + 0xd800, (cp & 0x3ff) + 0xdc00);
      }
    }
  }
  return out;
}

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

export function detectLineEnding(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Plans a note save operation:
 * 1. Only re-serializes edited blocks, preserving unedited blocks byte-for-byte.
 * 2. Preserves line endings (\r\n vs \n).
 * 3. Preserves presence or absence of final newline.
 * 4. Preserves UTF-8 BOM if original had it.
 * 5. Returns unchanged: true if final bytes match original bytes.
 */
export function planSave(
  original: Uint8Array | string | OriginalNoteDescriptor,
  edited: string | readonly MarkdownBlock[]
): SavePlan {
  let origText: string;
  let hasBom = false;
  let lineEnding: '\r\n' | '\n' = '\n';
  let hasFinalNewline = true;
  let origBytes: Uint8Array;

  if (typeof original === 'string') {
    origText = original;
    origBytes = encodeUtf8(original);
    lineEnding = detectLineEnding(original);
    hasFinalNewline = original.endsWith('\n') || original.endsWith('\r\n');
  } else if (original instanceof Uint8Array) {
    origBytes = original;
    hasBom = hasUtf8Bom(original);
    const bodyBytes = hasBom ? original.subarray(3) : original;
    origText = decodeUtf8(bodyBytes);
    lineEnding = detectLineEnding(origText);
    hasFinalNewline = origText.endsWith('\n') || origText.endsWith('\r\n');
  } else {
    origText = original.text;
    hasBom = original.hasBom ?? false;
    lineEnding = original.lineEnding ?? detectLineEnding(origText);
    hasFinalNewline = original.hasFinalNewline ?? (origText.endsWith('\n') || origText.endsWith('\r\n'));
    const bodyBytes = encodeUtf8(origText);
    origBytes = hasBom ? concatUint8Arrays(new Uint8Array([0xef, 0xbb, 0xbf]), bodyBytes) : bodyBytes;
  }

  let finalRawText: string;
  let changedBlockCount = 0;

  if (typeof edited === 'string') {
    // Check if edited string is identical to original string
    if (edited === origText) {
      return {
        unchanged: true,
        text: origText,
        bytes: origBytes,
        changedBlockCount: 0,
        lineEnding,
        hasBom,
        hasFinalNewline
      };
    }

    const origBlocks = blockSplitter(origText);
    const editedBlocks = blockSplitter(edited);

    // Block-level diffing to preserve unedited blocks byte-for-byte
    const assembledBlocks: string[] = [];
    let origIdx = 0;
    let editIdx = 0;

    while (origIdx < origBlocks.length && editIdx < editedBlocks.length) {
      const origB = origBlocks[origIdx];
      const editB = editedBlocks[editIdx];

      if (!origB || !editB) break;

      if (origB.type === editB.type) {
        if (origB.raw === editB.raw) {
          // Exactly identical block: preserve original raw slice 100%
          assembledBlocks.push(origB.raw);
          origIdx++;
          editIdx++;
        } else {
          // Block content modified
          assembledBlocks.push(editB.raw);
          changedBlockCount++;
          origIdx++;
          editIdx++;
        }
      } else {
        // Structural change (block added, removed or reordered)
        // Find next alignment match
        let foundOrig = -1;
        let foundEdit = -1;

        for (let o = origIdx; o < Math.min(origIdx + 5, origBlocks.length); o++) {
          for (let e = editIdx; e < Math.min(editIdx + 5, editedBlocks.length); e++) {
            const ob = origBlocks[o];
            const eb = editedBlocks[e];
            if (ob && eb && ob.type === eb.type && ob.raw === eb.raw) {
              foundOrig = o;
              foundEdit = e;
              break;
            }
          }
          if (foundOrig !== -1) break;
        }

        if (foundOrig !== -1 && foundEdit !== -1) {
          // Emit changed edited blocks up to foundEdit
          for (let e = editIdx; e < foundEdit; e++) {
            const b = editedBlocks[e];
            if (b) {
              assembledBlocks.push(b.raw);
              changedBlockCount++;
            }
          }
          origIdx = foundOrig;
          editIdx = foundEdit;
        } else {
          assembledBlocks.push(editB.raw);
          changedBlockCount++;
          origIdx++;
          editIdx++;
        }
      }
    }

    // Append any trailing edited blocks
    while (editIdx < editedBlocks.length) {
      const b = editedBlocks[editIdx++];
      if (b) {
        assembledBlocks.push(b.raw);
        changedBlockCount++;
      }
    }

    finalRawText = assembledBlocks.join('');
  } else {
    // Array of blocks passed directly
    finalRawText = edited.map((b) => b.raw).join('');
    // Compare block by block against original
    const origBlocks = blockSplitter(origText);
    for (let i = 0; i < Math.max(origBlocks.length, edited.length); i++) {
      const ob = origBlocks[i];
      const eb = edited[i];
      if (!ob || !eb || ob.raw !== eb.raw) {
        changedBlockCount++;
      }
    }
  }

  // 1. Harmonize line endings if original had CRLF
  let normalizedText = finalRawText;
  if (lineEnding === '\r\n') {
    normalizedText = normalizedText.replace(/(?<!\r)\n/g, '\r\n');
  } else {
    normalizedText = normalizedText.replace(/\r\n/g, '\n');
  }

  // 2. Final newline handling
  if (hasFinalNewline) {
    if (!normalizedText.endsWith('\n') && !normalizedText.endsWith('\r\n')) {
      normalizedText += lineEnding;
    }
  } else {
    // Strip trailing newline if original had none
    if (normalizedText.endsWith('\r\n')) {
      normalizedText = normalizedText.slice(0, -2);
    } else if (normalizedText.endsWith('\n')) {
      normalizedText = normalizedText.slice(0, -1);
    }
  }

  // 3. UTF-8 BOM handling
  const textBytes = encodeUtf8(normalizedText);
  let finalBytes: Uint8Array;
  if (hasBom) {
    finalBytes = concatUint8Arrays(new Uint8Array([0xef, 0xbb, 0xbf]), textBytes);
  } else {
    finalBytes = textBytes;
  }

  // 4. Byte comparison against original
  const unchanged = areUint8ArraysEqual(origBytes, finalBytes);

  return {
    unchanged,
    text: normalizedText,
    bytes: finalBytes,
    changedBlockCount: unchanged ? 0 : Math.max(1, changedBlockCount),
    lineEnding,
    hasBom,
    hasFinalNewline
  };
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
