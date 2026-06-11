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
    // Remove the class, force a reflow, then re-add it to replay the animation
    // without unmounting children (no blank-page flash)
    el.classList.remove('hh-page-transition');
    void el.offsetHeight;
    el.classList.add('hh-page-transition');
  }, [pathname]);

  return (
    <div ref={ref} className="hh-page-transition">
      {children}
    </div>
  );
}
