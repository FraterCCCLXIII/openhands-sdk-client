import type { ReactNode } from 'react';

export function AppPage({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2">
        <span className="truncate px-2 py-1 text-sm font-medium app-text">{title}</span>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <section className="app-card flex min-w-0 flex-1 overflow-hidden rounded-xl">
          <div className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</div>
        </section>
      </div>
    </>
  );
}
