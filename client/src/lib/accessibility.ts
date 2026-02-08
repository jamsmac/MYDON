/**
 * Accessibility utilities for WCAG 2.1 compliance
 *
 * Provides:
 * - ARIA label helpers
 * - Keyboard navigation utilities
 * - Focus management helpers
 * - Screen reader announcements
 */

import { useCallback, useEffect, useRef } from "react";

// ============ ARIA HELPERS ============

/**
 * Generate aria-label for status indicators
 */
export function getStatusAriaLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: "Статус: не начато",
    in_progress: "Статус: в работе",
    completed: "Статус: завершено",
    active: "Статус: активный",
    archived: "Статус: в архиве",
    pending: "Статус: ожидает",
  };
  return labels[status] || `Статус: ${status}`;
}

/**
 * Generate aria-label for priority indicators
 */
export function getPriorityAriaLabel(priority: string): string {
  const labels: Record<string, string> = {
    critical: "Приоритет: критический",
    high: "Приоритет: высокий",
    medium: "Приоритет: средний",
    low: "Приоритет: низкий",
  };
  return labels[priority] || `Приоритет: ${priority}`;
}

/**
 * Generate aria-label for progress indicators
 */
export function getProgressAriaLabel(completed: number, total: number): string {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `Прогресс: ${completed} из ${total} выполнено (${percentage}%)`;
}

/**
 * Generate aria-label for task item
 */
export function getTaskAriaLabel(task: {
  title: string;
  status: string;
  priority?: string;
  deadline?: Date | string | null;
}): string {
  const parts = [task.title, getStatusAriaLabel(task.status)];

  if (task.priority) {
    parts.push(getPriorityAriaLabel(task.priority));
  }

  if (task.deadline) {
    const date = new Date(task.deadline);
    parts.push(`Срок: ${date.toLocaleDateString("ru-RU")}`);
  }

  return parts.join(", ");
}

// ============ KEYBOARD NAVIGATION ============

/**
 * Common keyboard keys
 */
export const Keys = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
} as const;

/**
 * Check if event is an activation key (Enter or Space)
 */
export function isActivationKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return event.key === Keys.ENTER || event.key === Keys.SPACE;
}

/**
 * Check if event is an arrow key
 */
export function isArrowKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return (
    event.key === Keys.ARROW_UP ||
    event.key === Keys.ARROW_DOWN ||
    event.key === Keys.ARROW_LEFT ||
    event.key === Keys.ARROW_RIGHT
  );
}

/**
 * Handle keyboard navigation in a list
 */
export function handleListKeyDown(
  event: KeyboardEvent | React.KeyboardEvent,
  currentIndex: number,
  totalItems: number,
  onSelect: (index: number) => void
): void {
  let newIndex = currentIndex;

  switch (event.key) {
    case Keys.ARROW_DOWN:
      event.preventDefault();
      newIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
      break;
    case Keys.ARROW_UP:
      event.preventDefault();
      newIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
      break;
    case Keys.HOME:
      event.preventDefault();
      newIndex = 0;
      break;
    case Keys.END:
      event.preventDefault();
      newIndex = totalItems - 1;
      break;
    default:
      return;
  }

  onSelect(newIndex);
}

// ============ FOCUS MANAGEMENT ============

/**
 * Hook to trap focus within a container (for modals/dialogs)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement;

    // Find all focusable elements
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus the first element
    firstElement?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== Keys.TAB) return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the previously focused element
      (previousActiveElement.current as HTMLElement)?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to manage focus on escape key
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === Keys.ESCAPE) {
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, isActive]);
}

/**
 * Hook for roving tabindex pattern
 */
export function useRovingTabIndex(
  itemCount: number,
  initialIndex: number = 0
) {
  const currentIndexRef = useRef(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const setItemRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  const focusItem = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
    currentIndexRef.current = clampedIndex;
    itemRefs.current[clampedIndex]?.focus();
  }, [itemCount]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const current = currentIndexRef.current;

    switch (event.key) {
      case Keys.ARROW_DOWN:
      case Keys.ARROW_RIGHT:
        event.preventDefault();
        focusItem(current + 1);
        break;
      case Keys.ARROW_UP:
      case Keys.ARROW_LEFT:
        event.preventDefault();
        focusItem(current - 1);
        break;
      case Keys.HOME:
        event.preventDefault();
        focusItem(0);
        break;
      case Keys.END:
        event.preventDefault();
        focusItem(itemCount - 1);
        break;
    }
  }, [focusItem, itemCount]);

  const getTabIndex = useCallback((index: number) => {
    return index === currentIndexRef.current ? 0 : -1;
  }, []);

  return {
    setItemRef,
    handleKeyDown,
    getTabIndex,
    focusItem,
  };
}

// ============ SCREEN READER ANNOUNCEMENTS ============

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Hook for announcements
 */
export function useAnnounce() {
  return useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    announce(message, priority);
  }, []);
}

// ============ SKIP LINKS ============

/**
 * Skip link target IDs
 */
export const SkipLinkTargets = {
  MAIN_CONTENT: "main-content",
  NAVIGATION: "main-navigation",
  SIDEBAR: "sidebar",
  SEARCH: "search-input",
} as const;

/**
 * Create skip link props
 */
export function getSkipLinkProps(targetId: string) {
  return {
    href: `#${targetId}`,
    className: "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-primary",
  };
}

// ============ REDUCED MOTION ============

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ============ ARIA LABELS FOR ICON BUTTONS ============

/**
 * Standard ARIA labels for common icon buttons (bilingual Russian)
 */
export const ARIA_LABELS = {
  // Navigation
  close: "Закрыть",
  closeDialog: "Закрыть диалог",
  closePanel: "Закрыть панель",
  open: "Открыть",
  back: "Назад",
  forward: "Вперёд",
  menu: "Меню",
  moreOptions: "Дополнительные действия",

  // Search & Filter
  search: "Поиск",
  clearSearch: "Очистить поиск",
  filter: "Фильтр",
  clearFilters: "Сбросить фильтры",
  sort: "Сортировка",
  sortAscending: "Сортировать по возрастанию",
  sortDescending: "Сортировать по убыванию",

  // CRUD Actions
  add: "Добавить",
  create: "Создать",
  edit: "Редактировать",
  delete: "Удалить",
  save: "Сохранить",
  cancel: "Отмена",
  remove: "Удалить",
  copy: "Копировать",
  duplicate: "Дублировать",

  // View Actions
  refresh: "Обновить",
  reload: "Перезагрузить",
  expand: "Развернуть",
  collapse: "Свернуть",
  fullscreen: "Полноэкранный режим",
  minimize: "Свернуть",
  maximize: "Развернуть",

  // Task Actions
  markComplete: "Отметить как выполненную",
  markIncomplete: "Отметить как невыполненную",
  setPriority: "Установить приоритет",
  setDeadline: "Установить срок",
  assignTask: "Назначить исполнителя",
  unassignTask: "Снять исполнителя",

  // AI Actions
  aiChat: "Открыть AI чат",
  aiGenerate: "Сгенерировать с AI",
  aiSuggestions: "AI рекомендации",
  pasteContext: "Вставить контекст",
  clearChat: "Очистить чат",

  // View Modes
  listView: "Вид списком",
  tableView: "Табличный вид",
  kanbanView: "Канбан доска",
  calendarView: "Календарь",
  ganttView: "Диаграмма Ганта",

  // Drag and Drop
  dragHandle: "Перетащить для изменения порядка",
  dropZone: "Зона для перетаскивания",

  // Media
  upload: "Загрузить файл",
  download: "Скачать",
  attach: "Прикрепить файл",
  preview: "Предпросмотр",

  // Settings
  settings: "Настройки",
  preferences: "Предпочтения",
  theme: "Тема оформления",

  // User
  userProfile: "Профиль пользователя",
  logout: "Выйти",
  notifications: "Уведомления",

  // Misc
  help: "Справка",
  info: "Информация",
  warning: "Предупреждение",
  error: "Ошибка",
  loading: "Загрузка",
  sending: "Отправка",
} as const;

/**
 * Get ARIA label for icon button with optional context
 */
export function getAriaLabel(
  key: keyof typeof ARIA_LABELS,
  context?: string
): string {
  const label = ARIA_LABELS[key];
  return context ? `${label}: ${context}` : label;
}

/**
 * Generate aria-describedby for form fields
 */
export function getDescribedBy(
  fieldId: string,
  options: { hasError?: boolean; hasHint?: boolean }
): string | undefined {
  const ids: string[] = [];
  if (options.hasHint) ids.push(`${fieldId}-hint`);
  if (options.hasError) ids.push(`${fieldId}-error`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/**
 * Generate unique ID with prefix
 */
let a11yIdCounter = 0;
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${++a11yIdCounter}`;
}

/**
 * Hook for reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const ref = useRef(prefersReducedMotion());

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      ref.current = event.matches;
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return ref.current;
}
