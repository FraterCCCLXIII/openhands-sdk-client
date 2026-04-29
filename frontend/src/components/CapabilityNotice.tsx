import { Lock } from 'lucide-react';

export function CapabilityNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="app-card rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-neutral-soft)] app-text-muted">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold app-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 app-text-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}
