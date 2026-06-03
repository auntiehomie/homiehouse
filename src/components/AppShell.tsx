"use client";

import SidebarNav from "./SidebarNav";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", paddingBottom: 80 }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        <div className="flex gap-6 items-start">
          {/* Desktop sidebar — hidden below lg */}
          <aside
            className="hidden lg:block shrink-0"
            style={{ width: 220, position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", scrollbarWidth: "none" }}
          >
            <SidebarNav />
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
