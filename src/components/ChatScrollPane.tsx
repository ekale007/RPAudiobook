"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type ThumbState = { top: number; height: number; show: boolean };

function measureThumb(el: HTMLElement): ThumbState {
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight + 2) {
    return { top: 0, height: 0, show: false };
  }
  const height = Math.max(52, (clientHeight / scrollHeight) * clientHeight);
  const maxScroll = scrollHeight - clientHeight;
  const maxTop = clientHeight - height;
  const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0;
  return { top, height, show: true };
}

export function ChatScrollPane({
  children,
  scrollRef,
  onScroll,
  contentKey,
}: {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  /** Re-measure when chat content changes (turn count, stream draft, etc.) */
  contentKey: string;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const [thumb, setThumb] = useState<ThumbState>({
    top: 0,
    height: 52,
    show: false,
  });

  const getScrollEl = useCallback(
    () => scrollRef?.current ?? localRef.current,
    [scrollRef],
  );

  const updateThumb = useCallback(() => {
    const el = getScrollEl();
    if (!el) return;
    setThumb(measureThumb(el));
  }, [getScrollEl]);

  useEffect(() => {
    updateThumb();
  }, [updateThumb, contentKey]);

  useEffect(() => {
    const el = getScrollEl();
    if (!el) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateThumb, getScrollEl, scrollRef]);

  const handleScroll = () => {
    updateThumb();
    onScroll?.();
  };

  const scrollFromRailY = (clientY: number) => {
    const el = getScrollEl();
    const rail = railRef.current;
    if (!el || !rail || !thumb.show) return;
    const rect = rail.getBoundingClientRect();
    const y = clientY - rect.top - thumb.height / 2;
    const maxTop = rect.height - thumb.height;
    const ratio = maxTop > 0 ? Math.max(0, Math.min(1, y / maxTop)) : 0;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  const onRailPointerDown = (e: React.PointerEvent) => {
    const el = getScrollEl();
    if (!el || !thumb.show) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    scrollFromRailY(e.clientY);
  };

  const onRailPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    scrollFromRailY(e.clientY);
  };

  const onRailPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const setRefs = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (scrollRef && "current" in scrollRef) {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div
        ref={setRefs}
        data-chat-scroll
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-scroll overscroll-y-contain py-3 pl-11 pr-2 [scrollbar-width:none] sm:pl-12 sm:pr-2 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div
        ref={railRef}
        className="relative my-2 mr-1 w-4 shrink-0 touch-none select-none sm:mr-1.5 sm:w-[18px]"
        aria-hidden={!thumb.show}
        onPointerDown={onRailPointerDown}
        onPointerMove={onRailPointerMove}
        onPointerUp={onRailPointerUp}
        onPointerCancel={onRailPointerUp}
      >
        <div className="absolute inset-0 rounded-full bg-zinc-900/90 ring-1 ring-zinc-700/80" />
        {thumb.show ? (
          <div
            className="absolute inset-x-0.5 rounded-full border border-zinc-500/80 bg-zinc-600 shadow-md"
            style={{ top: thumb.top, height: thumb.height }}
          >
            <div className="absolute left-1/2 top-1/2 h-1 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-accent/35" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
