import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchView } from '../../src/renderer/components/SearchView';

describe('SearchView Component (src/renderer/components/SearchView.tsx)', () => {
  it('renders search input bar with placeholder and filter suggestions', () => {
    const html = renderToStaticMarkup(
      <SearchView
        selectedNotePath={null}
        onSelectNote={vi.fn()}
      />
    );

    expect(html).toContain('class="search-view"');
    expect(html).toContain('placeholder="Search notes, tag:, status:, folder:..."');
    expect(html).toContain('class="search-filter-pill"');
    expect(html).toContain('>tag:</button>');
    expect(html).toContain('>status:</button>');
    expect(html).toContain('>folder:</button>');
    expect(html).toContain('Type to search across the vault');
  });
});
