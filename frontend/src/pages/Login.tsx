import { Link } from 'react-router-dom';
import { getCapabilities } from '../lib/api';
import { CapabilityNotice } from '../components/CapabilityNotice';

export function Login() {
  const capabilities = getCapabilities();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Session</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">Sign in</h1>
        <p className="mt-2 text-sm leading-6 app-text-muted">
          SDK-only mode can run locally without a product account. OpenHands SaaS mode owns login, sessions, and organization membership.
        </p>
      </div>
      {capabilities.auth ? (
        <CapabilityNotice title="SaaS authentication" message="Connect a SaaS auth provider to complete this flow for hosted deployments." />
      ) : (
        <CapabilityNotice title="Local SDK mode" message="Authentication is not required for the local SDK facade. Configure backend credentials in Settings when targeting SaaS." />
      )}
      <Link to="/" className="app-button-accent inline-flex rounded-lg px-4 py-2 text-sm">
        Continue to dashboard
      </Link>
    </div>
  );
}
