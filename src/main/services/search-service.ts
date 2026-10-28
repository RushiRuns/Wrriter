import { type Result, ok, err } from '../../shared/result';
import type { IndexSearchResultItem } from '../../shared/ipc/contracts';
import { IndexClient } from './index-client';
import {
  matchQuickSwitcher,
  type QuickSwitcherItem
} from '../../shared/domain/quick-switcher';

export interface SearchServiceOptions {
  indexClient: IndexClient;
}

/**
 * Service orchestrating vault search with filters and the quick switcher (M3, UTILITIES.md).
 * Follows ARCHITECTURE.md rule 12: pure domain parsing and matching in shared/domain.
 */
export class SearchService {
  private readonly indexClient: IndexClient;

  constructor(options: SearchServiceOptions) {
    this.indexClient = options.indexClient;
  }

  /**
   * Searches notes in the current vault using FTS5 and filters (tag:, status:, folder:).
   * Title matches are ranked first, followed by most recently modified.
   */
  async search(
    query: string,
    limit = 50
  ): Promise<Result<readonly IndexSearchResultItem[]>> {
    if (!this.indexClient) {
      return ok([]);
    }
    return this.indexClient.search(query, limit);
  }

  /**
   * Generates candidate matches for the Quick Switcher using in-memory titles.
   * When query is empty: returns recent notes sorted by modified time.
   * When query is non-empty: loose title matching against the in-memory registry.
   * When nothing matches: returns a single creation candidate.
   */
  async getQuickSwitcherResults(
    query: string,
    limit = 30
  ): Promise<Result<readonly QuickSwitcherItem[]>> {
    if (!this.indexClient) {
      return ok([]);
    }

    const titleListRes = await this.indexClient.getTitleList();
    if (!titleListRes.ok) {
      return titleListRes;
    }

    const candidates = matchQuickSwitcher(titleListRes.value, query, limit);
    return ok(candidates);
  }
}
