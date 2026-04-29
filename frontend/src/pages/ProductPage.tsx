import { useEffect, useState } from 'react';
import { CapabilityNotice } from '../components/CapabilityNotice';
import type { ProductStatus } from '../types';

export function ProductPage({
  title,
  description,
  loadStatus,
}: {
  title: string;
  description: string;
  loadStatus: () => Promise<ProductStatus>;
}) {
  const [status, setStatus] = useState<ProductStatus | null>(null);

  useEffect(() => {
    loadStatus().then(setStatus).catch(() => setStatus({
      available: false,
      message: 'Unable to load this product capability from the selected backend.',
    }));
  }, [loadStatus]);

  if (!status) {
    return <div className="py-10 text-center app-text-muted">Loading {title.toLowerCase()}...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Product capability</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 app-text-muted">{description}</p>
      </div>
      <CapabilityNotice
        title={status.available ? `${title} connected` : `${title} not available`}
        message={status.message}
      />
    </div>
  );
}
