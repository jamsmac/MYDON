import { useRef, useCallback, TouchEvent } from "react";

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe
  preventScroll?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  preventScroll = false,
}: SwipeConfig) {
  const swipeState = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeState.current.startX = touch.clientX;
    swipeState.current.startY = touch.clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (preventScroll) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      swipeState.current.endX = touch.clientX;
      swipeState.current.endY = touch.clientY;
    },
    [preventScroll]
  );

  const handleTouchEnd = useCallback(() => {
    const { startX, startY, endX, endY } = swipeState.current;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine if it's a horizontal or vertical swipe
    if (absX > absY && absX > threshold) {
      // Horizontal swipe
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absY > absX && absY > threshold) {
      // Vertical swipe
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    // Reset state
    swipeState.current = { startX: 0, startY: 0, endX: 0, endY: 0 };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

// Hook for pull-to-refresh functionality
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || refreshing.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Prevent default scroll behavior
      e.preventDefault();

      // Apply visual feedback (max 100px)
      const pullDistance = Math.min(diff * 0.5, 100);
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${pullDistance}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || refreshing.current) return;

    pulling.current = false;

    if (containerRef.current) {
      const transform = containerRef.current.style.transform;
      const match = transform.match(/translateY\((\d+)px\)/);
      const pullDistance = match ? parseInt(match[1]) : 0;

      if (pullDistance >= 60) {
        // Trigger refresh
        refreshing.current = true;
        containerRef.current.style.transform = "translateY(60px)";

        try {
          await onRefresh();
        } finally {
          refreshing.current = false;
          if (containerRef.current) {
            containerRef.current.style.transform = "translateY(0)";
          }
        }
      } else {
        // Reset position
        containerRef.current.style.transform = "translateY(0)";
      }
    }
  }, [onRefresh]);

  return {
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isRefreshing: refreshing.current,
  };
}
