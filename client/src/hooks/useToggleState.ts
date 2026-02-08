/**
 * useToggleState - Hook for managing Set-based toggle state
 * Extracted from ProjectView.tsx for reusability
 *
 * Used for expandedBlocks, expandedSections, and similar toggle patterns
 */

import { useState, useCallback } from "react";

export interface UseToggleStateReturn {
  expanded: Set<number>;
  toggle: (id: number) => void;
  expand: (id: number) => void;
  collapse: (id: number) => void;
  expandAll: (ids: number[]) => void;
  collapseAll: () => void;
  isExpanded: (id: number) => boolean;
}

/**
 * Hook for managing a Set of expanded/toggled IDs
 *
 * @param initialIds - Optional initial set of expanded IDs
 * @returns Object with state and toggle functions
 *
 * @example
 * const blocks = useToggleState();
 * blocks.toggle(1); // Toggle block 1
 * blocks.isExpanded(1); // Check if expanded
 */
export function useToggleState(initialIds?: number[]): UseToggleStateReturn {
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(initialIds || [])
  );

  const toggle = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: number) => {
    setExpanded(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: number) => {
    setExpanded(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: number[]) => {
    setExpanded(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const isExpanded = useCallback((id: number) => {
    return expanded.has(id);
  }, [expanded]);

  return {
    expanded,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    isExpanded,
  };
}
