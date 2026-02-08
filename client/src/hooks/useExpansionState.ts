/**
 * Hook for managing expansion state of blocks and sections
 * Used in ProjectView for collapsible tree structure
 */

import { useState, useCallback, useEffect } from 'react';

export interface UseExpansionStateReturn {
  expandedBlocks: Set<number>;
  expandedSections: Set<number>;

  // Block operations
  isBlockExpanded: (blockId: number) => boolean;
  toggleBlock: (blockId: number) => void;
  expandBlock: (blockId: number) => void;
  collapseBlock: (blockId: number) => void;
  expandAllBlocks: (blockIds: number[]) => void;
  collapseAllBlocks: () => void;

  // Section operations
  isSectionExpanded: (sectionId: number) => boolean;
  toggleSection: (sectionId: number) => void;
  expandSection: (sectionId: number) => void;
  collapseSection: (sectionId: number) => void;
  expandAllSections: (sectionIds: number[]) => void;
  collapseAllSections: () => void;

  // Bulk operations
  expandAll: (blockIds: number[], sectionIds: number[]) => void;
  collapseAll: () => void;
}

export interface UseExpansionStateOptions {
  /** Auto-expand blocks on initial load */
  autoExpandBlocks?: boolean;
  /** Auto-expand sections on initial load */
  autoExpandSections?: boolean;
  /** Storage key for persisting state */
  storageKey?: string;
}

export function useExpansionState(options: UseExpansionStateOptions = {}): UseExpansionStateReturn {
  const { autoExpandBlocks = false, autoExpandSections = false, storageKey } = options;

  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${storageKey}_blocks`);
        if (saved) {
          return new Set(JSON.parse(saved));
        }
      } catch {
        // Ignore parse errors
      }
    }
    return new Set();
  });

  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${storageKey}_sections`);
        if (saved) {
          return new Set(JSON.parse(saved));
        }
      } catch {
        // Ignore parse errors
      }
    }
    return new Set();
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}_blocks`, JSON.stringify(Array.from(expandedBlocks)));
    }
  }, [expandedBlocks, storageKey]);

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}_sections`, JSON.stringify(Array.from(expandedSections)));
    }
  }, [expandedSections, storageKey]);

  // Block operations
  const isBlockExpanded = useCallback((blockId: number) => {
    return expandedBlocks.has(blockId);
  }, [expandedBlocks]);

  const toggleBlock = useCallback((blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const expandBlock = useCallback((blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.add(blockId);
      return next;
    });
  }, []);

  const collapseBlock = useCallback((blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
  }, []);

  const expandAllBlocks = useCallback((blockIds: number[]) => {
    setExpandedBlocks(new Set(blockIds));
  }, []);

  const collapseAllBlocks = useCallback(() => {
    setExpandedBlocks(new Set());
  }, []);

  // Section operations
  const isSectionExpanded = useCallback((sectionId: number) => {
    return expandedSections.has(sectionId);
  }, [expandedSections]);

  const toggleSection = useCallback((sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandSection = useCallback((sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  }, []);

  const collapseSection = useCallback((sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }, []);

  const expandAllSections = useCallback((sectionIds: number[]) => {
    setExpandedSections(new Set(sectionIds));
  }, []);

  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  // Bulk operations
  const expandAll = useCallback((blockIds: number[], sectionIds: number[]) => {
    setExpandedBlocks(new Set(blockIds));
    setExpandedSections(new Set(sectionIds));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedBlocks(new Set());
    setExpandedSections(new Set());
  }, []);

  return {
    expandedBlocks,
    expandedSections,

    // Block operations
    isBlockExpanded,
    toggleBlock,
    expandBlock,
    collapseBlock,
    expandAllBlocks,
    collapseAllBlocks,

    // Section operations
    isSectionExpanded,
    toggleSection,
    expandSection,
    collapseSection,
    expandAllSections,
    collapseAllSections,

    // Bulk operations
    expandAll,
    collapseAll,
  };
}
