"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      enter="hh-route-enter"
      exit="hh-route-exit"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
