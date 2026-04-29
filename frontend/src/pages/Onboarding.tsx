import { Link } from 'react-router-dom';
import { SettingsSection, SettingsRow } from '../components/design';

export function Onboarding() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Onboarding</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">Set up your OpenHands client</h1>
        <p className="mt-2 text-sm leading-6 app-text-muted">
          This lightweight onboarding flow mirrors the full product shape while keeping runtime setup SDK-first.
        </p>
      </div>
      <SettingsSection title="Recommended setup">
        <SettingsRow
          label="Choose backend mode"
          description="Use prototype for the SDK facade, local for OpenHands Main, or cloud for a hosted OpenHands-compatible backend."
          control={<Link to="/settings/connection" className="app-button-accent rounded-lg px-4 py-2 text-sm">Open connection settings</Link>}
        />
        <SettingsRow
          label="Configure LLM credentials"
          description="Set model, base URL, and redacted API keys before starting long-running conversations."
          control={<Link to="/settings/llm" className="app-button-subtle rounded-lg px-4 py-2 text-sm">Open LLM settings</Link>}
        />
        <SettingsRow
          label="Create a conversation"
          description="Start with a repo task, suggested task, or direct chat once the backend is ready."
          control={<Link to="/launch" className="app-button-subtle rounded-lg px-4 py-2 text-sm">Open launch flow</Link>}
        />
      </SettingsSection>
    </div>
  );
}
