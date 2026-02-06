import { createContext, useContext, useCallback, useRef } from 'react';

interface Message {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface EntityAIChatStoreContextType {
  getMessages: (entityType: string, entityId: number) => Message[];
  setMessages: (entityType: string, entityId: number, messages: Message[]) => void;
  clearMessages: (entityType: string, entityId: number) => void;
  clearAll: () => void;
}

const MAX_ENTITIES = 30;
const MAX_MESSAGES_PER_ENTITY = 50;

const EntityAIChatStoreContext = createContext<EntityAIChatStoreContextType | null>(null);

function makeKey(entityType: string, entityId: number): string {
  return `${entityType}:${entityId}`;
}

/**
 * Provider that maintains an in-memory cache of AI chat messages per entity.
 * Messages are keyed by "entityType:entityId" and survive component unmount/remount
 * as long as the provider stays mounted (typically at the project view level).
 * 
 * Limits:
 * - Max 30 entities cached (LRU eviction of oldest)
 * - Max 50 messages per entity (oldest trimmed)
 */
export function EntityAIChatStoreProvider({ children }: { children: React.ReactNode }) {
  // Use ref instead of state to avoid unnecessary re-renders of the entire tree
  const storeRef = useRef<Map<string, { messages: Message[]; lastAccessed: number }>>(new Map());

  const evictIfNeeded = useCallback(() => {
    const store = storeRef.current;
    if (store.size > MAX_ENTITIES) {
      // Find and remove the least recently accessed entity
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [key, value] of Array.from(store.entries())) {
        if (value.lastAccessed < oldestTime) {
          oldestTime = value.lastAccessed;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        store.delete(oldestKey);
      }
    }
  }, []);

  const getMessages = useCallback((entityType: string, entityId: number): Message[] => {
    const key = makeKey(entityType, entityId);
    const entry = storeRef.current.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.messages;
    }
    return [];
  }, []);

  const setMessages = useCallback((entityType: string, entityId: number, messages: Message[]) => {
    const key = makeKey(entityType, entityId);
    // Only keep non-streaming, completed messages and trim to max
    const filtered = messages
      .filter(m => !m.isStreaming)
      .slice(-MAX_MESSAGES_PER_ENTITY);
    
    storeRef.current.set(key, {
      messages: filtered,
      lastAccessed: Date.now(),
    });
    evictIfNeeded();
  }, [evictIfNeeded]);

  const clearMessages = useCallback((entityType: string, entityId: number) => {
    const key = makeKey(entityType, entityId);
    storeRef.current.delete(key);
  }, []);

  const clearAll = useCallback(() => {
    storeRef.current.clear();
  }, []);

  return (
    <EntityAIChatStoreContext.Provider value={{ getMessages, setMessages, clearMessages, clearAll }}>
      {children}
    </EntityAIChatStoreContext.Provider>
  );
}

export function useEntityAIChatStore() {
  const ctx = useContext(EntityAIChatStoreContext);
  if (!ctx) {
    // Return a no-op fallback so EntityAIChat works even without the provider
    return {
      getMessages: () => [] as Message[],
      setMessages: () => {},
      clearMessages: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}
