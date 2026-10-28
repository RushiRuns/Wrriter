import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagTree } from '../../src/renderer/components/TagTree';
import type { IndexTagCount } from '../../src/shared/ipc/contracts';

describe('TagTree Component (src/renderer/components/TagTree.tsx)', () => {
  const sampleTags: IndexTagCount[] = [
    { tag: 'Engineering', count: 3 },
    { tag: 'Engineering/Frontend', count: 2 },
    { tag: 'Engineering/Backend', count: 4 },
    { tag: 'Life', count: 5 }
  ];

  it('renders TAGS header and folder-row structure', () => {
    const onSelectTag = vi.fn();
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const html = renderToStaticMarkup(
      <TagTree
        tagsWithCounts={sampleTags}
        selectedTag={null}
        onSelectTag={onSelectTag}
        onRefresh={onRefresh}
      />
    );

    // TAGS Header
    expect(html).toContain('TAGS');

    // Built from folder row (.fr, .nm, .ct)
    expect(html).toContain('class="fr');
    expect(html).toContain('#Engineering');
    expect(html).toContain('#Life');
    expect(html).toContain('class="ct">5</span>');
  });

  it('highlights selected tag with .sel class', () => {
    const html = renderToStaticMarkup(
      <TagTree
        tagsWithCounts={sampleTags}
        selectedTag="Life"
        onSelectTag={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(html).toMatch(/class="fr\s+sel[^"]*".*?#Life/s);
  });

  it('renders empty message when no tags are present', () => {
    const html = renderToStaticMarkup(
      <TagTree
        tagsWithCounts={[]}
        selectedTag={null}
        onSelectTag={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(html).toContain('No tags in vault');
  });

  it('renders expand chevron toggle for parent tag nodes with children', () => {
    const html = renderToStaticMarkup(
      <TagTree
        tagsWithCounts={sampleTags}
        selectedTag={null}
        onSelectTag={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />
    );

    // Parent node has Expand tag button with chevron
    expect(html).toContain('aria-label="Expand tag"');
    expect(html).toContain('class="ic cv"');
  });
});
