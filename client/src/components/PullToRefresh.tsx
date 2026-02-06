import { useRef, useState, useCallback, useEffect, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/hooks/useMobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  /** Minimum pull distance (px) to trigger refresh */
  threshold?: number;
  /** Maximum visual pull distance (px) */
  maxPull?: number;
  /** Whether pull-to-refresh is enabled (auto-disabled on desktop) */
  enabled?: boolean;
  /** Custom loading text */
  loadingText?: string;
  /** Custom pull text */
  pullText?: string;
  /** Custom release text */
  releaseText?: string;
}

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 70,
  maxPull = 120,
  enabled = true,
  loadingText = 'Обновление...',
  pullText = 'Потяните вниз для обновления',
  releaseText = 'Отпустите для обновления',
}: PullToRefreshProps) {
  const { isMobile } = useMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentPull = useRef(0);
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const isActive = useRef(false);

  // Only enable on mobile
  const isEnabled = enabled && isMobile;

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isEnabled || pullState === 'refreshing') return;

    const container = containerRef.current;
    if (!container) return;

    // Find the nearest scrollable parent or self
    let scrollTop = 0;
    let el: HTMLElement | null = e.target as HTMLElement;
    while (el && el !== container) {
      if (el.scrollTop > 0) {
        scrollTop = el.scrollTop;
        break;
      }
      el = el.parentElement;
    }
    if (scrollTop === 0) {
      scrollTop = container.scrollTop;
    }

    // Only start if at the top of scroll
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isActive.current = true;
    }
  }, [isEnabled, pullState]);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isEnabled || !isActive.current || pullState === 'refreshing') return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff <= 0) {
      // Scrolling up, reset
      if (pullState !== 'idle') {
        setPullState('idle');
        setPullDistance(0);
        currentPull.current = 0;
      }
      return;
    }

    // Apply resistance curve for natural feel
    const resistance = 0.4;
    const rawPull = diff * resistance;
    const clampedPull = Math.min(rawPull, maxPull);

    currentPull.current = clampedPull;
    setPullDistance(clampedPull);

    if (clampedPull >= threshold) {
      setPullState('ready');
    } else {
      setPullState('pulling');
    }
  }, [isEnabled, pullState, threshold, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isEnabled || !isActive.current || pullState === 'refreshing') return;

    isActive.current = false;

    if (pullState === 'ready') {
      // Trigger refresh
      setPullState('refreshing');
      setPullDistance(60); // Snap to indicator height

      try {
        await onRefresh();
      } catch (error) {
        console.error('[PullToRefresh] Refresh failed:', error);
      } finally {
        setPullState('idle');
        setPullDistance(0);
        currentPull.current = 0;
      }
    } else {
      // Reset
      setPullState('idle');
      setPullDistance(0);
      currentPull.current = 0;
    }
  }, [isEnabled, pullState, onRefresh]);

  // Prevent native pull-to-refresh on the container when our custom one is active
  useEffect(() => {
    if (!isEnabled) return;
    const container = containerRef.current;
    if (!container) return;

    const preventNative = (e: Event) => {
      if (pullState === 'pulling' || pullState === 'ready') {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventNative, { passive: false });
    return () => {
      container.removeEventListener('touchmove', preventNative);
    };
  }, [isEnabled, pullState]);

  // Calculate indicator styles
  const indicatorOpacity = pullState === 'idle' ? 0 : Math.min(pullDistance / threshold, 1);
  const indicatorScale = pullState === 'refreshing' ? 1 : Math.min(pullDistance / threshold, 1);
  const arrowRotation = pullState === 'ready' || pullState === 'refreshing' ? 180 : (pullDistance / threshold) * 180;

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {isEnabled && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center justify-end overflow-hidden pointer-events-none z-40"
          style={{
            top: 0,
            height: `${pullDistance}px`,
            transition: pullState === 'idle' || pullState === 'refreshing'
              ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          }}
        >
          <div
            className="flex flex-col items-center gap-1.5 pb-2"
            style={{
              opacity: indicatorOpacity,
              transform: `scale(${indicatorScale})`,
              transition: pullState === 'idle' || pullState === 'refreshing'
                ? 'opacity 0.3s, transform 0.3s'
                : 'none',
            }}
          >
            {pullState === 'refreshing' ? (
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
            ) : (
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200",
                  pullState === 'ready'
                    ? "bg-amber-500/20"
                    : "bg-slate-700/50"
                )}
              >
                <ArrowDown
                  className={cn(
                    "w-5 h-5 transition-colors duration-200",
                    pullState === 'ready' ? "text-amber-400" : "text-slate-400"
                  )}
                  style={{
                    transform: `rotate(${arrowRotation}deg)`,
                    transition: pullState === 'pulling' ? 'transform 0.1s' : 'transform 0.3s',
                  }}
                />
              </div>
            )}
            <span className={cn(
              "text-[11px] font-medium transition-colors duration-200",
              pullState === 'refreshing' ? "text-amber-400" :
              pullState === 'ready' ? "text-amber-400" : "text-slate-500"
            )}>
              {pullState === 'refreshing' ? loadingText :
               pullState === 'ready' ? releaseText : pullText}
            </span>
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          transform: isEnabled && pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
          transition: pullState === 'idle' || pullState === 'refreshing'
            ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
