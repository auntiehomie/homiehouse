"use client";

import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // key={pathname} causes React to replace the div on navigation,
  // which re-triggers the CSS animation defined in globals.css
  return (
    <div key={pathname} className="hh-page-transition">
      {children}
    </div>
  );
}
