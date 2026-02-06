import { useRef, useCallback, useState, type TouchEvent } from 'react';

interface SwipeNavigationConfig {
  /** List of items to navigate through */
  items: { id: number; title: string; type: string }[];
  /** Currently selected item index */
  currentIndex: number;
  /** Callback when navigating to a new item */
  onNavigate: (item: { id: number; title: string; type: string }, direction: 'left' | 'right') => void;
  /** Minimum distance in px to trigger a swipe (default: 60) */
  threshold?: number;
  /** Whether swipe navigation is enabled (default: true) */
  enabled?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isTracking: boolean;
  isHorizontal: boolean | null; // null = not yet determined
}

export function useSwipeNavigation({
  items,
  currentIndex,
  onNavigate,
  threshold = 60,
  enabled = true,
}: SwipeNavigationConfig) {
  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    isTracking: false,
    isHorizontal: null,
  });

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || items.length <= 1) return;
      const touch = e.touches[0];
      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        isTracking: true,
        isHorizontal: null,
      };
      setSwipeOffset(0);
      setIsAnimating(false);
    },
    [enabled, items.length]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !stateRef.current.isTracking) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - stateRef.current.startX;
      const deltaY = touch.clientY - stateRef.current.startY;

      // Determine direction on first significant movement
      if (stateRef.current.isHorizontal === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 10 || absY > 10) {
          stateRef.current.isHorizontal = absX > absY;
          if (!stateRef.current.isHorizontal) {
            // Vertical scroll - stop tracking
            stateRef.current.isTracking = false;
            setSwipeOffset(0);
            return;
          }
        } else {
          return; // Wait for more movement
        }
      }

      if (!stateRef.current.isHorizontal) return;

      stateRef.current.currentX = touch.clientX;

      // Check bounds - don't allow swiping past the edges
      const canGoLeft = currentIndex < items.length - 1;
      const canGoRight = currentIndex > 0;

      if ((deltaX < 0 && !canGoLeft) || (deltaX > 0 && !canGoRight)) {
        // Apply resistance at edges
        const resistance = 0.2;
        setSwipeOffset(deltaX * resistance);
      } else {
        // Normal swipe with slight resistance
        const resistance = 0.6;
        setSwipeOffset(deltaX * resistance);
      }
    },
    [enabled, currentIndex, items.length]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !stateRef.current.isTracking) return;

    const deltaX = stateRef.current.currentX - stateRef.current.startX;
    stateRef.current.isTracking = false;
    stateRef.current.isHorizontal = null;

    const canGoLeft = currentIndex < items.length - 1;
    const canGoRight = currentIndex > 0;

    if (Math.abs(deltaX) >= threshold) {
      if (deltaX < 0 && canGoLeft) {
        // Swipe left → go to next item
        const nextItem = items[currentIndex + 1];
        setIsAnimating(true);
        setSwipeOffset(-window.innerWidth);
        setTimeout(() => {
          onNavigate(nextItem, 'left');
          setSwipeOffset(0);
          setIsAnimating(false);
        }, 200);
        return;
      } else if (deltaX > 0 && canGoRight) {
        // Swipe right → go to previous item
        const prevItem = items[currentIndex - 1];
        setIsAnimating(true);
        setSwipeOffset(window.innerWidth);
        setTimeout(() => {
          onNavigate(prevItem, 'right');
          setSwipeOffset(0);
          setIsAnimating(false);
        }, 200);
        return;
      }
    }

    // Snap back
    setIsAnimating(true);
    setSwipeOffset(0);
    setTimeout(() => setIsAnimating(false), 200);
  }, [enabled, currentIndex, items, threshold, onNavigate]);

  return {
    swipeHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    swipeOffset,
    isAnimating,
    canGoLeft: currentIndex < items.length - 1,
    canGoRight: currentIndex > 0,
    currentIndex,
    totalItems: items.length,
  };
}
