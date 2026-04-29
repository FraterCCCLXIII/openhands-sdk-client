import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConversation, listRepositories, listSuggestedTasks } from '../lib/api';
import type { Repository, SuggestedTask } from '../types';

export function Launch() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState('');
  const [tasks, setTasks] = useState<SuggestedTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRepositories().then(result => setRepositories(result.repositories)).catch(() => setRepositories([]));
  }, []);

  useEffect(() => {
    listSuggestedTasks(selectedRepository || undefined).then(result => setTasks(result.tasks)).catch(() => setTasks([]));
  }, [selectedRepository]);

  async function startConversation(initialTitle?: string) {
    setCreating(true);
    setError(null);
    try {
      const result = await createConversation(initialTitle || title || 'New OpenHands task');
      navigate(`/chat/${result.conversation_id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Launch</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">Start an OpenHands task</h1>
        <p className="mt-2 text-sm leading-6 app-text-muted">
          Pick a repository and suggested task when the backend supports it, or start a direct SDK conversation.
        </p>
      </div>

      <section className="app-card rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium app-text">Conversation title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-lg border app-border bg-bg px-3 py-2 app-text"
              placeholder="Describe the task..."
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium app-text">Repository</span>
            <select
              value={selectedRepository}
              onChange={(event) => setSelectedRepository(event.target.value)}
              className="mt-2 w-full rounded-lg border app-border bg-bg px-3 py-2 app-text"
            >
              <option value="">No repository selected</option>
              {repositories.map(repository => (
                <option key={repository.id} value={repository.full_name}>{repository.full_name}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg app-status-danger px-3 py-2 text-sm">{error}</p>}
        <button
          type="button"
          disabled={creating}
          onClick={() => startConversation()}
          className="app-button-accent mt-4 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {creating ? 'Starting...' : 'Start conversation'}
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold app-text">Suggested tasks</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {tasks.length === 0 ? (
            <div className="app-card rounded-xl p-4 text-sm app-text-muted">No suggested tasks are available from the selected backend.</div>
          ) : tasks.map(task => (
            <button
              key={task.id}
              type="button"
              onClick={() => startConversation(task.title)}
              className="app-card rounded-xl p-4 text-left hover:border-primary"
            >
              <div className="font-medium app-text">{task.title}</div>
              {task.description && <p className="mt-1 text-sm app-text-muted">{task.description}</p>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
