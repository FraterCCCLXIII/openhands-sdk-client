import { createContext, useContext, useState, type ReactNode } from 'react';

type RailContextValue = {
  expanded: boolean;
  toggle: () => void;
};

const RailContext = createContext<RailContextValue | null>(null);

function useRail(): RailContextValue {
  const context = useContext(RailContext);
  if (!context) {
    throw new Error('Rail subcomponents must be rendered inside <Rail>.');
  }
  return context;
}

export function Rail({
  defaultExpanded = false,
  children,
}: {
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const widthClass = expanded ? 'w-52' : 'w-14';

  return (
    <RailContext.Provider value={{ expanded, toggle: () => setExpanded(value => !value) }}>
      <nav
        aria-label="Primary navigation"
        className={`${widthClass} flex shrink-0 flex-col transition-[width] duration-150`}
      >
        {children}
      </nav>
    </RailContext.Provider>
  );
}

export function RailLogo({ label }: { label: string }) {
  const { expanded, toggle } = useRail();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      className="flex h-12 items-center gap-2 rounded-xl px-4 app-button-subtle"
    >
      <span className="text-xl leading-none" aria-hidden>🙌</span>
      {expanded && <span className="text-sm font-medium app-text">{label}</span>}
    </button>
  );
}

export function RailItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const { expanded } = useRail();
  const layout = expanded ? 'w-full px-2.5' : 'w-9 justify-center';
  const state = active ? 'app-list-item-active' : 'app-list-item';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={!expanded ? label : undefined}
      className={`flex h-9 ${layout} items-center gap-2.5 rounded-md ${state}`}
    >
      {icon}
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

export function RailGroup({ children }: { children: ReactNode }) {
  return <div className="flex-1 space-y-0.5 px-2 pt-1">{children}</div>;
}

export function RailFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto space-y-0.5 px-2 pb-3">{children}</div>;
}
