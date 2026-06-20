'use client';

/**
 * NeynarProvider — legacy wrapper. Now just renders children.
 * The actual auth provider is PrivyAuthProvider in layout.tsx.
 */

export default function NeynarProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
