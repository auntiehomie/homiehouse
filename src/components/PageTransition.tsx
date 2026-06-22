"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    // Skip the very first mount — the initial animation handles it via CSS class
    if (isFirst.current) { isFirst.current = false; return; }
    const el = ref.current;
    if (!el) return;
    // Disable pointer events during the opacity-0 phase of the animation.
    // On iOS, opacity:0 elements still absorb touches and can permanently
    // confuse the browser's touch target tracking.
    el.style.pointerEvents = 'none';
    el.classList.remove('hh-page-transition');
    void el.offsetHeight;
    el.classList.add('hh-page-transition');
    const timer = setTimeout(() => { el.style.pointerEvents = ''; }, 150);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div ref={ref} className="hh-page-transition">
      {children}
    </div>
  );
}
