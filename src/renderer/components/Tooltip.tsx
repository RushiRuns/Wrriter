import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delayMs?: number;
  placement?: 'top' | 'bottom';
}

/**
 * Universal Tooltip component that appears after ~500 ms of hover,
 * fading in at Fast (100 ms) with 8 px corners and token styling.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delayMs = 500,
  placement = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = placement === 'top' ? rect.top - 6 : rect.bottom + 6;
        setCoords({ x, y });
        setIsVisible(true);
      }
    }, delayMs);
  };

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const child = React.cloneElement(children as React.ReactElement<any>, {
    ref: (node: HTMLElement | null) => {
      targetRef.current = node;
      const originalRef = (children as any).ref;
      if (typeof originalRef === 'function') {
        originalRef(node);
      } else if (originalRef) {
        originalRef.current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      (children as any).props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      (children as any).props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      (children as any).props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      (children as any).props.onBlur?.(e);
    }
  });

  return (
    <>
      {child}
      {isVisible && (
        <div
          className={`wr-tooltip ${placement}`}
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 1000
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};
