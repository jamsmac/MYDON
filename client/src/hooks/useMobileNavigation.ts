/**
 * useMobileNavigation - Hook for mobile navigation callbacks
 * Extracted from ProjectView.tsx for reusability
 *
 * Handles task/context selection with mobile-specific behavior
 * (showing detail panel, hiding sidebar)
 */

import { useCallback } from "react";

export interface SelectedContext {
  type: "project" | "block" | "section" | "task";
  id: number;
  title: string;
  content?: string;
}

export interface SelectedTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  notes?: string | null;
  summary?: string | null;
  sectionId: number;
  sortOrder?: number | null;
}

export interface MobileNavigationOptions {
  isMobile: boolean;
  setSelectedTask: (task: SelectedTask | null) => void;
  setSelectedContext: (context: SelectedContext | null) => void;
  setMobileShowDetail: (show: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export interface MobileNavigationReturn {
  /** Select a task (shows detail panel on mobile) */
  selectTask: (task: SelectedTask) => void;
  /** Select a context (block/section, shows detail on mobile) */
  selectContext: (context: SelectedContext | null) => void;
  /** Go back to list view (hides detail, clears selection) */
  backToList: () => void;
}

/**
 * Hook for mobile-aware navigation callbacks
 *
 * @example
 * const { selectTask, selectContext, backToList } = useMobileNavigation({
 *   isMobile,
 *   setSelectedTask,
 *   setSelectedContext,
 *   setMobileShowDetail,
 *   setMobileSidebarOpen,
 * });
 */
export function useMobileNavigation(
  options: MobileNavigationOptions
): MobileNavigationReturn {
  const {
    isMobile,
    setSelectedTask,
    setSelectedContext,
    setMobileShowDetail,
    setMobileSidebarOpen,
  } = options;

  const selectTask = useCallback(
    (task: SelectedTask) => {
      setSelectedTask(task);
      if (isMobile) {
        setMobileShowDetail(true);
        setMobileSidebarOpen(false);
      }
    },
    [isMobile, setSelectedTask, setMobileShowDetail, setMobileSidebarOpen]
  );

  const selectContext = useCallback(
    (context: SelectedContext | null) => {
      setSelectedContext(context);
      if (isMobile && context) {
        setMobileShowDetail(true);
        setMobileSidebarOpen(false);
      }
    },
    [isMobile, setSelectedContext, setMobileShowDetail, setMobileSidebarOpen]
  );

  const backToList = useCallback(() => {
    setMobileShowDetail(false);
    setSelectedTask(null);
    setSelectedContext(null);
  }, [setMobileShowDetail, setSelectedTask, setSelectedContext]);

  return {
    selectTask,
    selectContext,
    backToList,
  };
}
