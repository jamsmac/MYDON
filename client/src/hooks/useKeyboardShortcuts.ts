import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onOpenAI?: () => void;
  onNewProject?: () => void;
  onSearch?: () => void;
  onSave?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.isContentEditable;

    // Cmd/Ctrl + K - Open AI Assistant
    if (modifier && event.key === 'k') {
      event.preventDefault();
      handlers.onOpenAI?.();
      return;
    }

    // Cmd/Ctrl + N - New Project (only when not in input)
    if (modifier && event.key === 'n' && !isInput) {
      event.preventDefault();
      handlers.onNewProject?.();
      return;
    }

    // Cmd/Ctrl + F or / - Search
    if ((modifier && event.key === 'f') || (event.key === '/' && !isInput)) {
      event.preventDefault();
      handlers.onSearch?.();
      return;
    }

    // Cmd/Ctrl + S - Save
    if (modifier && event.key === 's') {
      event.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Escape - Close dialogs
    if (event.key === 'Escape') {
      handlers.onEscape?.();
      return;
    }
  }, [handlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Keyboard shortcut display helper
export function getShortcutDisplay(key: string): string {
  const isMac = typeof navigator !== 'undefined' && 
                navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? '⌘' : 'Ctrl';
  return `${modifier}+${key.toUpperCase()}`;
}
