import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, FileText, GitBranch, LayoutList, ListChecks, Monitor, Puzzle, Terminal } from 'lucide-react';
import {
  getRuntimeLinks,
  listGitChanges,
  listMcpServers,
  listSkills,
  listStartTasks,
  readWorkspaceFile,
} from '../../lib/api';
import type { Conversation, ConversationEvent, GitChange, McpServerInfo, RuntimeLink, SkillInfo, StartTask, WorkspaceFile } from '../../types';

type WorkspaceTab = 'chat' | 'events' | 'files' | 'changes' | 'runtime' | 'tasks' | 'skills' | 'terminal';

const tabs: Array<{ key: WorkspaceTab; label: string; icon: ReactNode }> = [
  { key: 'chat', label: 'Chat', icon: <LayoutList className="h-4 w-4" /> },
  { key: 'events', label: 'Events', icon: <ListChecks className="h-4 w-4" /> },
  { key: 'files', label: 'Files', icon: <FileText className="h-4 w-4" /> },
  { key: 'changes', label: 'Diffs', icon: <GitBranch className="h-4 w-4" /> },
  { key: 'runtime', label: 'Runtime', icon: <Monitor className="h-4 w-4" /> },
  { key: 'tasks', label: 'Tasks', icon: <ListChecks className="h-4 w-4" /> },
  { key: 'skills', label: 'Skills', icon: <Puzzle className="h-4 w-4" /> },
  { key: 'terminal', label: 'Terminal', icon: <Terminal className="h-4 w-4" /> },
];

export function WorkspaceTabs({
  activeTab,
  onActiveTabChange,
}: {
  activeTab: WorkspaceTab;
  onActiveTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b app-border bg-[var(--app-surface-muted)] p-2">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onActiveTabChange(tab.key)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            activeTab === tab.key ? 'app-segmented-option-active' : 'app-segmented-option'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceTabPanel({
  tab,
  conversation,
  events,
  children,
}: {
  tab: WorkspaceTab;
  conversation: Conversation | null;
  events: ConversationEvent[];
  children: ReactNode;
}) {
  if (tab === 'chat') return children;
  if (tab === 'events') return <EventsPanel events={events} />;
  if (tab === 'files') return <FilesPanel conversation={conversation} />;
  if (tab === 'changes') return <ChangesPanel conversation={conversation} />;
  if (tab === 'runtime') return <RuntimePanel conversation={conversation} />;
  if (tab === 'tasks') return <TasksPanel />;
  if (tab === 'skills') return <SkillsPanel />;
  return <TerminalPanel />;
}

function EventsPanel({ events }: { events: ConversationEvent[] }) {
  return (
    <div className="flex-1 overflow-auto p-6">
      <h2 className="text-lg font-semibold app-text">Event timeline</h2>
      <p className="mt-1 text-sm app-text-muted">Raw normalized events from the selected backend.</p>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <EmptyPanel message="No events loaded yet." />
        ) : events.map(event => (
          <div key={event.id} className="app-card rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 text-xs app-text-subtle">
              <span>{event.type} · {event.source}</span>
              <span>{new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <pre className="mt-2 overflow-auto rounded bg-bg p-3 text-xs app-text">{JSON.stringify(event.content, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPanel({ conversation }: { conversation: Conversation | null }) {
  const [path, setPath] = useState('PLAN.md');
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFile() {
    if (!conversation) return;
    setError(null);
    try {
      setFile(await readWorkspaceFile(conversation.id, path));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to read file');
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <h2 className="text-lg font-semibold app-text">Workspace files</h2>
      <p className="mt-1 text-sm app-text-muted">Read files through the selected backend when the capability is available.</p>
      <div className="mt-4 flex gap-2">
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          className="flex-1 rounded-lg border app-border bg-bg px-3 py-2 text-sm app-text"
        />
        <button type="button" onClick={loadFile} className="app-button-accent rounded-lg px-4 py-2 text-sm">
          Open
        </button>
      </div>
      {error && <p className="mt-4 app-status-danger rounded-lg px-3 py-2 text-sm">{error}</p>}
      {file && (
        <pre className="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-bg p-4 text-sm app-text">{file.content}</pre>
      )}
    </div>
  );
}

function ChangesPanel({ conversation }: { conversation: Conversation | null }) {
  const [changes, setChanges] = useState<GitChange[]>([]);

  useEffect(() => {
    if (!conversation) return;
    listGitChanges(conversation.id).then(result => setChanges(result.changes)).catch(() => setChanges([]));
  }, [conversation]);

  return (
    <SimpleListPanel
      title="Git changes"
      description="Diffs and changed files reported by the selected runtime."
      empty="No changed files are available yet."
      items={changes.map(change => `${change.status}: ${change.path}`)}
      icon={<GitBranch className="h-5 w-5" />}
    />
  );
}

function RuntimePanel({ conversation }: { conversation: Conversation | null }) {
  const [links, setLinks] = useState<RuntimeLink[]>([]);

  useEffect(() => {
    getRuntimeLinks(conversation).then(result => setLinks(result.links)).catch(() => setLinks([]));
  }, [conversation]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <h2 className="text-lg font-semibold app-text">Runtime links</h2>
      <p className="mt-1 text-sm app-text-muted">Sandbox, browser, served app, VS Code, and agent-server URLs exposed by the backend.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {links.length === 0 ? (
          <EmptyPanel message="No runtime links are available for this conversation." />
        ) : links.map(link => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="app-card rounded-lg p-4 hover:border-primary">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium app-text">{link.label}</span>
              <ExternalLink className="h-4 w-4 app-text-muted" />
            </div>
            <p className="mt-1 truncate text-xs app-text-subtle">{link.url}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function TasksPanel() {
  const [tasks, setTasks] = useState<StartTask[]>([]);

  useEffect(() => {
    listStartTasks().then(result => setTasks(result.tasks)).catch(() => setTasks([]));
  }, []);

  return (
    <SimpleListPanel
      title="Start tasks"
      description="Provisioning and conversation startup tasks from OpenHands Main compatible backends."
      empty="No start tasks are available."
      items={tasks.map(task => `${task.status}: ${task.detail ?? task.conversation_id ?? task.id}`)}
      icon={<ListChecks className="h-5 w-5" />}
    />
  );
}

function SkillsPanel() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [servers, setServers] = useState<McpServerInfo[]>([]);

  useEffect(() => {
    listSkills().then(result => setSkills(result.skills)).catch(() => setSkills([]));
    listMcpServers().then(result => setServers(result.servers)).catch(() => setServers([]));
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6">
      <h2 className="text-lg font-semibold app-text">Skills and MCP</h2>
      <p className="mt-1 text-sm app-text-muted">Runtime skill and MCP capability inventory.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SimpleListCard title="Skills" empty="No skills reported." items={skills.map(skill => `${skill.name}${skill.type ? ` · ${skill.type}` : ''}`)} />
        <SimpleListCard title="MCP servers" empty="No MCP servers reported." items={servers.map(server => `${server.name} · ${server.status}`)} />
      </div>
    </div>
  );
}

function TerminalPanel() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="app-card rounded-xl p-6">
        <Terminal className="h-8 w-8 app-text-muted" />
        <h2 className="mt-4 text-lg font-semibold app-text">Terminal</h2>
        <p className="mt-2 text-sm leading-6 app-text-muted">
          Terminal streaming is an SDK runtime concern. This tab is reserved for the Agent Server terminal channel once exposed through the SDK facade.
        </p>
      </div>
    </div>
  );
}

function SimpleListPanel({
  title,
  description,
  empty,
  items,
  icon,
}: {
  title: string;
  description: string;
  empty: string;
  items: string[];
  icon: ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold app-text">{icon}{title}</h2>
      <p className="mt-1 text-sm app-text-muted">{description}</p>
      <SimpleListCard title={title} empty={empty} items={items} className="mt-4" />
    </div>
  );
}

function SimpleListCard({ title, empty, items, className = '' }: { title: string; empty: string; items: string[]; className?: string }) {
  return (
    <div className={`app-card rounded-xl p-4 ${className}`}>
      <h3 className="text-sm font-semibold app-text">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm app-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(item => <li key={item} className="rounded-lg bg-bg px-3 py-2 text-sm app-text">{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="app-card rounded-xl p-6 text-sm app-text-muted">
      {message}
    </div>
  );
}

export type { WorkspaceTab };
