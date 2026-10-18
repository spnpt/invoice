import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh for the installed (home screen) app, which has no browser reload button.
 * Pull down from the very top of the page by ~80px and release to reload.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const standalone = (navigator as any).standalone || matchMedia('(display-mode: standalone)').matches;
    if (!standalone) return; // Safari tabs already have their own pull-to-refresh.

    const onStart = (e: TouchEvent) => {
      // Ignore when scrolled down or when a modal/bottom sheet is open.
      start.current = window.scrollY <= 0 && !document.querySelector('[data-modal]') ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      setPull(dy > 0 ? Math.min(dy * 0.5, 90) : 0);
    };
    const onEnd = () => {
      setPull(p => {
        if (p >= 70) location.reload();
        return 0;
      });
      start.current = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  if (pull <= 4) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${pull - 30}px)` }}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow">
        <div className={`h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent ${pull >= 70 ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pull * 4}deg)` }} />
      </div>
    </div>
  );
}
