import { useState, useCallback, useEffect } from "react";

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
}

interface AchievementResult {
  newAchievements: Achievement[];
  totalNewPoints: number;
}

// Global queue for achievement notifications
let achievementQueue: Achievement[] = [];
let listeners: Set<(achievements: Achievement[]) => void> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener([...achievementQueue]));
}

export function addAchievementsToQueue(achievements: Achievement[]) {
  if (achievements.length > 0) {
    achievementQueue.push(...achievements);
    notifyListeners();
  }
}

export function popAchievementFromQueue(): Achievement | null {
  if (achievementQueue.length > 0) {
    const achievement = achievementQueue.shift()!;
    notifyListeners();
    return achievement;
  }
  return null;
}

/**
 * Hook to handle achievement results from mutations
 * Automatically adds new achievements to the notification queue
 */
export function useAchievementTrigger() {
  const handleAchievementResult = useCallback((result: { achievements?: AchievementResult | null }) => {
    if (result?.achievements?.newAchievements && result.achievements.newAchievements.length > 0) {
      addAchievementsToQueue(result.achievements.newAchievements);
    }
  }, []);

  return { handleAchievementResult };
}

/**
 * Hook to subscribe to achievement notifications
 * Returns the current achievement to display and a function to dismiss it
 */
export function useAchievementNotifications() {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [queueLength, setQueueLength] = useState(achievementQueue.length);

  useEffect(() => {
    const listener = (queue: Achievement[]) => {
      setQueueLength(queue.length);
      
      // If no current achievement and queue has items, show the first one
      if (!currentAchievement && queue.length > 0) {
        const achievement = popAchievementFromQueue();
        if (achievement) {
          setCurrentAchievement(achievement);
        }
      }
    };

    listeners.add(listener);
    
    // Check initial queue
    if (achievementQueue.length > 0 && !currentAchievement) {
      const achievement = popAchievementFromQueue();
      if (achievement) {
        setCurrentAchievement(achievement);
      }
    }

    return () => {
      listeners.delete(listener);
    };
  }, [currentAchievement]);

  const dismissCurrent = useCallback(() => {
    setCurrentAchievement(null);
    
    // Show next achievement after a short delay
    setTimeout(() => {
      if (achievementQueue.length > 0) {
        const achievement = popAchievementFromQueue();
        if (achievement) {
          setCurrentAchievement(achievement);
        }
      }
    }, 300);
  }, []);

  return {
    currentAchievement,
    dismissCurrent,
    queueLength,
  };
}
