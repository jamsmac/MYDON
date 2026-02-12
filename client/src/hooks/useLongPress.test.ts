import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

describe('useLongPress Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic Long-Press Detection', () => {
    it('should trigger onLongPress after default duration', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).toHaveBeenCalled();
    });

    it('should trigger onLongPress after custom duration', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ duration: 500, onLongPress }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onLongPress).toHaveBeenCalled();
    });

    it('should not trigger if disabled', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, disabled: true }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('Touch Movement Cancellation', () => {
    it('should cancel long-press if user moves beyond threshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        const mockMoveEvent = { touches: [{ clientX: 20, clientY: 0 }] } as any;
        result.current.onTouchMove(mockMoveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('should allow small movements within threshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        const mockMoveEvent = { touches: [{ clientX: 5, clientY: 0 }] } as any;
        result.current.onTouchMove(mockMoveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).toHaveBeenCalled();
    });
  });

  describe('Touch End Handling', () => {
    it('should trigger onLongPressEnd when touch ends after long-press', () => {
      const onLongPress = vi.fn();
      const onLongPressEnd = vi.fn();
      const { result } = renderHook(() =>
        useLongPress({ onLongPress, onLongPressEnd })
      );

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).toHaveBeenCalled();

      act(() => {
        const mockEndEvent = { touches: [] } as any;
        result.current.onTouchEnd(mockEndEvent);
      });

      expect(onLongPressEnd).toHaveBeenCalled();
    });

    it('should not trigger onLongPressEnd if long-press never occurred', () => {
      const onLongPressEnd = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPressEnd }));

      act(() => {
        const mockEvent = { touches: [{ clientX: 0, clientY: 0 }] } as any;
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        const mockEndEvent = { touches: [] } as any;
        result.current.onTouchEnd(mockEndEvent);
      });

      expect(onLongPressEnd).not.toHaveBeenCalled();
    });
  });

  describe('Mouse Events', () => {
    it('should support mouse events', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => {
        const mockEvent = { clientX: 0, clientY: 0 } as any;
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).toHaveBeenCalled();
    });

    it('should cancel long-press on mouse leave', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => {
        const mockEvent = { clientX: 0, clientY: 0 } as any;
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        const mockLeaveEvent = { clientX: 0, clientY: 0 } as any;
        result.current.onMouseLeave(mockLeaveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });
});
