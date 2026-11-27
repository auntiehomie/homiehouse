"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      name="hh-route"
      share="auto"
      enter="auto"
      exit="auto"
      default="none"
    >
      <div className="hh-route-content">
        {children}
      </div>
    </ViewTransition>
  );
}
