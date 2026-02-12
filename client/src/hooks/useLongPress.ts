import { useRef, useCallback, useState } from 'react';

interface LongPressOptions {
  duration?: number; // milliseconds (default: 300)
  onLongPress?: (e: React.TouchEvent | React.MouseEvent) => void;
  onLongPressEnd?: () => void;
  disabled?: boolean;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  isLongPressing: boolean;
}

export function useLongPress(options: LongPressOptions = {}): LongPressHandlers {
  const {
    duration = 300,
    onLongPress,
    onLongPressEnd,
    disabled = false,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const MOVE_THRESHOLD = 10; // pixels - max movement before canceling long-press

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number, event: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;

      startPosRef.current = { x: clientX, y: clientY };
      setIsLongPressing(false);

      clearTimer();

      timerRef.current = setTimeout(() => {
        setIsLongPressing(true);
        onLongPress?.(event);
      }, duration);
    },
    [duration, onLongPress, disabled, clearTimer]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current) return;

      const deltaX = Math.abs(clientX - startPosRef.current.x);
      const deltaY = Math.abs(clientY - startPosRef.current.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Cancel long-press if user moves too far
      if (distance > MOVE_THRESHOLD) {
        clearTimer();
        setIsLongPressing(false);
      }
    },
    [clearTimer]
  );

  const handleEnd = useCallback(() => {
    clearTimer();
    if (isLongPressing) {
      setIsLongPressing(false);
      onLongPressEnd?.();
    }
  }, [clearTimer, isLongPressing, onLongPressEnd]);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY, e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      handleEnd();
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    onMouseDown: (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY, e);
    },
    onMouseUp: (e: React.MouseEvent) => {
      handleEnd();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleEnd();
    },
    isLongPressing,
  };
}
