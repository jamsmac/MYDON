import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface BlockDeadline {
  blockId: string;
  deadline: string; // ISO date string
  reminderDays: number; // Days before deadline to remind
  notified: boolean;
}

interface DeadlineState {
  deadlines: Record<string, BlockDeadline>;
  notificationsEnabled: boolean;
}

interface DeadlineContextType {
  state: DeadlineState;
  setBlockDeadline: (blockId: string, deadline: string, reminderDays?: number) => void;
  removeBlockDeadline: (blockId: string) => void;
  getBlockDeadline: (blockId: string) => BlockDeadline | null;
  getDeadlineStatus: (blockId: string) => 'overdue' | 'due_soon' | 'on_track' | 'no_deadline';
  getDaysRemaining: (blockId: string) => number | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
  markNotified: (blockId: string) => void;
}

const STORAGE_KEY = 'techrent-deadlines';

const DeadlineContext = createContext<DeadlineContextType | null>(null);

export function DeadlineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DeadlineState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back to defaults
      }
    }
    return {
      deadlines: {},
      notificationsEnabled: false,
    };
  });

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Check for upcoming deadlines and show notifications
  useEffect(() => {
    if (!state.notificationsEnabled) return;

    const checkDeadlines = () => {
      Object.values(state.deadlines).forEach(deadline => {
        if (deadline.notified) return;

        const daysRemaining = getDaysRemainingInternal(deadline.deadline);
        if (daysRemaining !== null && daysRemaining <= deadline.reminderDays && daysRemaining >= 0) {
          showNotification(deadline.blockId, daysRemaining);
          markNotified(deadline.blockId);
        }
      });
    };

    // Check immediately and then every hour
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.deadlines, state.notificationsEnabled]);

  const getDaysRemainingInternal = (deadline: string): number | null => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const showNotification = (blockId: string, daysRemaining: number) => {
    if (!('Notification' in window)) return;
    
    const title = daysRemaining === 0 
      ? 'Дедлайн сегодня!' 
      : `Дедлайн через ${daysRemaining} ${getDaysWord(daysRemaining)}`;
    
    new Notification('TechRent Roadmap', {
      body: title,
      icon: '/favicon.ico',
      tag: `deadline-${blockId}`,
    });
  };

  const getDaysWord = (days: number): string => {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  };

  const setBlockDeadline = useCallback((blockId: string, deadline: string, reminderDays = 3) => {
    setState(prev => ({
      ...prev,
      deadlines: {
        ...prev.deadlines,
        [blockId]: {
          blockId,
          deadline,
          reminderDays,
          notified: false,
        },
      },
    }));
  }, []);

  const removeBlockDeadline = useCallback((blockId: string) => {
    setState(prev => {
      const { [blockId]: _, ...rest } = prev.deadlines;
      return {
        ...prev,
        deadlines: rest,
      };
    });
  }, []);

  const getBlockDeadline = useCallback((blockId: string): BlockDeadline | null => {
    return state.deadlines[blockId] || null;
  }, [state.deadlines]);

  const getDeadlineStatus = useCallback((blockId: string): 'overdue' | 'due_soon' | 'on_track' | 'no_deadline' => {
    const deadline = state.deadlines[blockId];
    if (!deadline) return 'no_deadline';

    const daysRemaining = getDaysRemainingInternal(deadline.deadline);
    if (daysRemaining === null) return 'no_deadline';
    
    if (daysRemaining < 0) return 'overdue';
    if (daysRemaining <= deadline.reminderDays) return 'due_soon';
    return 'on_track';
  }, [state.deadlines]);

  const getDaysRemaining = useCallback((blockId: string): number | null => {
    const deadline = state.deadlines[blockId];
    if (!deadline) return null;
    return getDaysRemainingInternal(deadline.deadline);
  }, [state.deadlines]);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      setState(prev => ({ ...prev, notificationsEnabled: true }));
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setState(prev => ({ ...prev, notificationsEnabled: true }));
        return true;
      }
    }

    return false;
  }, []);

  const disableNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notificationsEnabled: false }));
  }, []);

  const markNotified = useCallback((blockId: string) => {
    setState(prev => ({
      ...prev,
      deadlines: {
        ...prev.deadlines,
        [blockId]: {
          ...prev.deadlines[blockId],
          notified: true,
        },
      },
    }));
  }, []);

  return (
    <DeadlineContext.Provider
      value={{
        state,
        setBlockDeadline,
        removeBlockDeadline,
        getBlockDeadline,
        getDeadlineStatus,
        getDaysRemaining,
        enableNotifications,
        disableNotifications,
        markNotified,
      }}
    >
      {children}
    </DeadlineContext.Provider>
  );
}

export function useDeadlines() {
  const context = useContext(DeadlineContext);
  if (!context) {
    throw new Error('useDeadlines must be used within a DeadlineProvider');
  }
  return context;
}
