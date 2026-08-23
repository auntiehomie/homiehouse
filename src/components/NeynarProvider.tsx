'use client';

/**
 * NeynarProvider — legacy wrapper. Now just renders children.
 * Auth is handled by FarcasterAuthProvider in the layout..
 */

export default function NeynarProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
