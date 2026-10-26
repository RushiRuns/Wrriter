/**
 * Pass-through elements that must be kept word-for-word, shown as text,
 * never executed, highlighted by find, and never changed by replace.
 * (SCHEMA.md Note Body)
 */

export interface PassThroughSpan {
  readonly kind:
    | 'comment'
    | 'block_id'
    | 'embed'
    | 'highlight'
    | 'footnote'
    | 'raw_html'
    | 'math'
    | 'mermaid'
    | 'custom_task_state'
    | 'templater_tag'
    | 'inline_dataview'
    | 'dataview_block'
    | 'block_link';
  readonly raw: string;
  readonly start: number;
  readonly end: number;
}

const TEMPLATER_TAG_REGEX = /<%(?:_|\*|#)?[\s\S]*?(?:_|\*|#)?%>/g;
const INLINE_DATAVIEW_REGEX = /(?:^[ \t]*|[ \t]+)([a-zA-Z0-9_\-]+)::[ \t]*(.+?)(?=[ \t]+[a-zA-Z0-9_\-]+::|$)/gm;
const BLOCK_ID_REGEX = /\^[a-zA-Z0-9\-]+(?=[ \t]*(?:\r?\n|$))/g;
const BLOCK_LINK_REGEX = /\[\[[^\]#|]+#\^[a-zA-Z0-9\-]+(?:\|[^\]]+)?\]\]/g;
const EMBED_REGEX = /!\[\[[^\]]+\]\]/g;
const HIGHLIGHT_REGEX = /==[^=\r\n]+==/g;
const INLINE_COMMENT_REGEX = /%%[\s\S]*?%%/g;
const CUSTOM_TASK_STATE_REGEX = /^[ \t]*-[ \t]+\[([^ xX])\][ \t]+/gm;
const FOOTNOTE_REF_REGEX = /\[\^[^\]\r\n]+\](?![ \t]*:)/g;

/**
 * Finds all pass-through spans within a text slice.
 */
export function findPassThroughSpans(text: string): PassThroughSpan[] {
  const spans: PassThroughSpan[] = [];

  const addMatches = (
    regex: RegExp,
    kind: PassThroughSpan['kind']
  ): void => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      spans.push({
        kind,
        raw: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  };

  addMatches(TEMPLATER_TAG_REGEX, 'templater_tag');
  addMatches(INLINE_DATAVIEW_REGEX, 'inline_dataview');
  addMatches(BLOCK_ID_REGEX, 'block_id');
  addMatches(BLOCK_LINK_REGEX, 'block_link');
  addMatches(EMBED_REGEX, 'embed');
  addMatches(HIGHLIGHT_REGEX, 'highlight');
  addMatches(INLINE_COMMENT_REGEX, 'comment');
  addMatches(CUSTOM_TASK_STATE_REGEX, 'custom_task_state');
  addMatches(FOOTNOTE_REF_REGEX, 'footnote');

  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Determines whether a code block language is a Dataview block.
 */
export function isDataviewLanguage(lang: string): boolean {
  const normalized = lang.trim().toLowerCase();
  return normalized === 'dataview' || normalized === 'dataviewjs';
}

/**
 * Determines whether note content or raw HTML contains scripts that must never run.
 */
export function containsScriptTag(content: string): boolean {
  return /<script\b[^>]*>[\s\S]*?<\/script>/i.test(content);
}
