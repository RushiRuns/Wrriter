import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickSwitcher } from '../../src/renderer/components/QuickSwitcher';

describe('QuickSwitcher Component (src/renderer/components/QuickSwitcher.tsx)', () => {
  it('returns empty markup when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <QuickSwitcher
        isOpen={false}
        onClose={vi.fn()}
        onOpenNote={vi.fn()}
        onCreateNote={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog structure when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <QuickSwitcher
        isOpen={true}
        onClose={vi.fn()}
        onOpenNote={vi.fn()}
        onCreateNote={vi.fn()}
      />
    );

    expect(html).toContain('class="quick-switcher-backdrop"');
    expect(html).toContain('class="quick-switcher-modal"');
    expect(html).toContain('placeholder="Type note title to open..."');
    expect(html).toContain('Ctrl+↵ to open in new tab');
  });
});
