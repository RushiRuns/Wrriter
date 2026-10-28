import React, { useRef, useState, useEffect, useCallback } from 'react';
import { flipGlide } from '../motion';

export interface VirtualListProps<T> {
  items: readonly T[];
  itemHeight?: number;
  overscan?: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  enableGlideAnimation?: boolean;
}

/**
 * Helper to determine whether list items have actually reordered or changed membership,
 * warranting a FLIP glide animation. Pure selection changes, content edits, or title updates
 * with identical keys and ordering do not trigger reorder animations.
 */
export function shouldAnimateReorder(
  prevKeys: readonly string[],
  currentKeys: readonly string[]
): boolean {
  if (prevKeys.length === 0) return false;
  if (prevKeys.length !== currentKeys.length) return true;
  return prevKeys.some((key, idx) => key !== currentKeys[idx]);
}

export function VirtualList<T>({
  items,
  itemHeight = 84, // 80px row + 4px margin
  overscan = 5,
  getKey,
  renderItem,
  className = 'rows',
  style,
  enableGlideAnimation = true
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Position tracking for FLIP glide animations
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const itemRefsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevKeysRef = useRef<string[]>([]);

  // Update viewport dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      setViewportHeight(el.clientHeight || 600);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll events with RAF
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      if (el) {
        setScrollTop(el.scrollTop);
      }
    });
  }, []);

  // FLIP glide animation on reordering (for lists <= 50 items)
  useEffect(() => {
    if (!enableGlideAnimation || items.length > 50) return;

    const prevRects = prevRectsRef.current;
    const currentItemRefs = itemRefsRef.current;
    const prevKeys = prevKeysRef.current;
    const currentKeys = items.map((item, idx) => getKey(item, idx));

    // 1. Capture clean, untransformed layout positions BEFORE starting any animations
    // to prevent active Web Animation transforms from polluting next render coordinates
    const newRects = new Map<string, DOMRect>();
    for (const [key, element] of currentItemRefs.entries()) {
      if (element) {
        newRects.set(key, element.getBoundingClientRect());
      }
    }

    // 2. Only trigger FLIP glide animations when items have actually changed order or membership
    if (shouldAnimateReorder(prevKeys, currentKeys)) {
      for (const [key, element] of currentItemRefs.entries()) {
        const prevRect = prevRects.get(key);
        if (prevRect && element) {
          flipGlide(element, prevRect);
        }
      }
    }

    prevRectsRef.current = newRects;
    prevKeysRef.current = currentKeys;
  }, [items, enableGlideAnimation, getKey]);

  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{
        overflowY: 'auto',
        position: 'relative',
        ...style
      }}
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative'
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0
          }}
        >
          {visibleItems.map((item, localIdx) => {
            const index = startIndex + localIdx;
            const key = getKey(item, index);
            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) {
                    itemRefsRef.current.set(key, el);
                  } else {
                    itemRefsRef.current.delete(key);
                  }
                }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
