import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedConversation } from '../lib/api';
import { CapabilityNotice } from '../components/CapabilityNotice';
import type { Conversation, ConversationEvent } from '../types';

export function SharedConversation() {
  const { id = '' } = useParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSharedConversation(id)
      .then(result => {
        setConversation(result.conversation);
        setEvents(result.events);
      })
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) return <div className="py-10 text-center app-text-muted">Loading shared conversation...</div>;

  if (!conversation) {
    return (
      <CapabilityNotice
        title="Shared conversations unavailable"
        message="Shared links are a product/backend capability. Connect an OpenHands SaaS-compatible backend to enable this route."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Shared conversation</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">{conversation.title}</h1>
      </div>
      <div className="space-y-3">
        {events.map(event => (
          <div key={event.id} className="app-card rounded-lg p-4">
            <div className="text-xs app-text-subtle">{event.source} · {event.type}</div>
            <pre className="mt-2 overflow-auto text-sm app-text">{JSON.stringify(event.content, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
