'use client';

/**
 * NeynarAuthProvider — legacy wrapper kept for layout compatibility.
 * Auth sync is now handled by PrivyAuthSync. This component is a passthrough.
 */

export default function NeynarAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
