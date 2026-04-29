import type { ReactNode } from 'react';

export function AppShell({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-canvas)] pl-2 app-text">
      {rail}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
