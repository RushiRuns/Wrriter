export interface Command {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly shortcut?: string;
  readonly keywords?: readonly string[];
  readonly run: () => void | Promise<void>;
  readonly isEnabled?: () => boolean;
}

export interface CommandMatch {
  readonly command: Command;
  readonly score: number;
}

/**
 * Computes a fuzzy matching score between a search query and a command.
 * Higher score indicates a better match. 0 means no match.
 */
export function scoreCommand(query: string, command: Command): number {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 1; // All commands match an empty query

  const titleLower = command.title.toLowerCase();
  const categoryLower = command.category.toLowerCase();
  const shortcutLower = command.shortcut?.toLowerCase() ?? '';
  const keywordsLower = (command.keywords ?? []).map((k) => k.toLowerCase());

  // 1. Exact match on title
  if (titleLower === cleanQuery) {
    return 1000;
  }

  // 2. Starts with query
  if (titleLower.startsWith(cleanQuery)) {
    return 500 + (cleanQuery.length / titleLower.length) * 100;
  }

  // 3. Word prefix match (e.g., "new" in "Create New Note")
  const words = titleLower.split(/[\s:_-]+/);
  for (const word of words) {
    if (word.startsWith(cleanQuery)) {
      return 350 + (cleanQuery.length / word.length) * 50;
    }
  }

  // 4. Substring match in title
  const substrIdx = titleLower.indexOf(cleanQuery);
  if (substrIdx !== -1) {
    return 200 - substrIdx * 2;
  }

  // 5. Acronym match (e.g., "cnt" matches "Create New Note")
  const acronym = words.map((w) => w[0] ?? '').join('');
  if (acronym.startsWith(cleanQuery)) {
    return 180;
  }

  // 6. Shortcut exact match
  if (shortcutLower && (shortcutLower === cleanQuery || shortcutLower.replace('+', '') === cleanQuery)) {
    return 160;
  }

  // 7. Keyword match
  for (const kw of keywordsLower) {
    if (kw === cleanQuery) return 150;
    if (kw.startsWith(cleanQuery)) return 120;
    if (kw.includes(cleanQuery)) return 90;
  }

  // 8. Category match
  if (categoryLower.startsWith(cleanQuery)) {
    return 70;
  }

  // 9. Subsequence fuzzy match across title
  let queryIdx = 0;
  let matchesInOrder = 0;
  for (let i = 0; i < titleLower.length && queryIdx < cleanQuery.length; i++) {
    if (titleLower[i] === cleanQuery[queryIdx]) {
      queryIdx++;
      matchesInOrder++;
    }
  }

  if (queryIdx === cleanQuery.length) {
    return 50 + matchesInOrder;
  }

  return 0; // No match
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  registerBatch(commands: readonly Command[]): void {
    for (const cmd of commands) {
      this.commands.set(cmd.id, cmd);
    }
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  getById(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): readonly Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): readonly CommandMatch[] {
    const results: CommandMatch[] = [];

    for (const cmd of this.commands.values()) {
      if (cmd.isEnabled && !cmd.isEnabled()) {
        continue;
      }

      const score = scoreCommand(query, cmd);
      if (score > 0) {
        results.push({ command: cmd, score });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.command.title.localeCompare(b.command.title);
    });

    return results;
  }
}

/**
 * Global application command registry singleton.
 */
export const commandRegistry = new CommandRegistry();
