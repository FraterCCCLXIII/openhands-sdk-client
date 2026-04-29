import { useState } from 'react';
import { X, MessageSquarePlus } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title?: string) => Promise<void>;
}

export function NewChatModal({ isOpen, onClose, onSubmit }: NewChatModalProps) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      await onSubmit(title.trim() || undefined);
      setTitle('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="app-card w-full max-w-md overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b app-border px-6 py-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            New Conversation
          </h2>
          <button 
            onClick={onClose}
            className="app-button-subtle rounded p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <label className="block text-sm text-text-secondary mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter conversation title..."
              className="w-full rounded-lg border app-border bg-bg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              disabled={isCreating}
              autoFocus
            />
            {error && (
              <p className="mt-3 rounded-lg app-status-danger px-3 py-2 text-sm">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t app-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="app-button-subtle rounded-lg px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="app-button-accent rounded-lg px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
