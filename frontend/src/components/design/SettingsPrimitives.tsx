import type { ReactNode } from 'react';

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-card flex flex-col overflow-hidden rounded-2xl">
      <div className="border-b app-border px-6 py-5">
        <h3 className="text-base font-semibold app-text">{title}</h3>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 app-text-muted">
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t app-border px-6 py-5 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-xl">
        <h4 className="text-sm font-medium app-text">{label}</h4>
        <p className="mt-1 text-sm leading-6 app-text-muted">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

type SegmentedChoiceOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export function SegmentedChoice<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedChoiceOption<T>[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-xl border app-border bg-[var(--app-surface-muted)] p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex min-w-24 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              selected ? 'app-segmented-option-active' : 'app-segmented-option'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
