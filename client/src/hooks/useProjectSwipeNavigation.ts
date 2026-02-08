/**
 * useProjectSwipeNavigation - Swipe navigation logic for ProjectView
 * Extracted from ProjectView.tsx
 */

import { useMemo, useCallback } from 'react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  sections?: ProjectSection[];
}

interface ProjectSection {
  id: number;
  title: string;
}

interface SelectedContext {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
  content?: string;
}

interface UseProjectSwipeNavigationOptions {
  project: { blocks?: ProjectBlock[] } | null | undefined;
  selectedContext: SelectedContext | null;
  isMobile: boolean;
  mobileShowDetail: boolean;
  selectedTask: { id: number } | null;
  getContextContent: (type: string, id: number) => string;
  setSelectedContext: (ctx: SelectedContext | null) => void;
  setSelectedTask: (task: null) => void;
  setAIChatTask: (task: null) => void;
  setMobileShowDetail: (show: boolean) => void;
}

export function useProjectSwipeNavigation({
  project,
  selectedContext,
  isMobile,
  mobileShowDetail,
  selectedTask,
  getContextContent,
  setSelectedContext,
  setSelectedTask,
  setAIChatTask,
  setMobileShowDetail,
}: UseProjectSwipeNavigationOptions) {
  // Build navigation items
  const swipeNavigationItems = useMemo(() => {
    if (!project?.blocks) return [];
    if (selectedContext?.type === 'section') {
      const parentBlock = project.blocks.find((b) => b.sections?.some((s) => s.id === selectedContext.id));
      if (parentBlock?.sections) {
        return parentBlock.sections.map((s) => ({ id: s.id, title: s.title, type: 'section' as const }));
      }
    }
    return project.blocks.map((b) => ({ id: b.id, title: b.titleRu || b.title, type: 'block' as const }));
  }, [project, selectedContext]);

  // Current index
  const swipeCurrentIndex = useMemo(() => {
    if (!selectedContext) return 0;
    const idx = swipeNavigationItems.findIndex((item) => item.id === selectedContext.id && item.type === selectedContext.type);
    return idx >= 0 ? idx : 0;
  }, [swipeNavigationItems, selectedContext]);

  // Navigate handler
  const handleSwipeNavigate = useCallback((item: { id: number; title: string; type: string }) => {
    setSelectedContext({
      type: item.type as 'block' | 'section',
      id: item.id,
      title: item.title,
      content: getContextContent(item.type, item.id),
    });
    setSelectedTask(null);
    setAIChatTask(null);
    if (isMobile) setMobileShowDetail(true);
  }, [getContextContent, isMobile, setSelectedContext, setSelectedTask, setAIChatTask, setMobileShowDetail]);

  // Use swipe navigation hook
  const { swipeHandlers, swipeOffset, isAnimating, canGoLeft, canGoRight } = useSwipeNavigation({
    items: swipeNavigationItems,
    currentIndex: swipeCurrentIndex,
    onNavigate: handleSwipeNavigate,
    enabled: isMobile && mobileShowDetail && !selectedTask,
    threshold: 60,
  });

  return {
    swipeNavigationItems,
    swipeCurrentIndex,
    swipeHandlers,
    swipeOffset,
    isAnimating,
    canGoNext: canGoLeft,
    canGoPrev: canGoRight,
  };
}
