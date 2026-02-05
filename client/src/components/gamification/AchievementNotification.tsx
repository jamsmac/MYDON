import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
}

interface AchievementNotificationProps {
  achievement: Achievement;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function AchievementNotification({
  achievement,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto close after delay
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(closeTimer);
      };
    }

    return () => clearTimeout(showTimer);
  }, [autoClose, autoCloseDelay]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 transition-all duration-300 transform",
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      )}
    >
      <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/20 backdrop-blur-lg border border-amber-500/30 rounded-lg shadow-2xl shadow-amber-500/20 p-4 min-w-[300px] max-w-[400px]">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4">
          {/* Achievement Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 animate-bounce">
              {achievement.icon}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Achievement Details */}
          <div className="flex-1">
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wider">
              Achievement Unlocked!
            </p>
            <h3 className="text-lg font-bold text-foreground mt-1">
              {achievement.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {achievement.description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-amber-500 font-semibold">
                +{achievement.points} points
              </span>
            </div>
          </div>
        </div>

        {/* Sparkle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full animate-ping"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${10 + Math.random() * 80}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1.5s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook to manage achievement notifications queue
export function useAchievementNotifications() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [current, queue]);

  const addNotification = (achievement: Achievement) => {
    setQueue((prev) => [...prev, achievement]);
  };

  const addNotifications = (achievements: Achievement[]) => {
    setQueue((prev) => [...prev, ...achievements]);
  };

  const dismissCurrent = () => {
    setCurrent(null);
  };

  return {
    current,
    addNotification,
    addNotifications,
    dismissCurrent,
    queueLength: queue.length,
  };
}
