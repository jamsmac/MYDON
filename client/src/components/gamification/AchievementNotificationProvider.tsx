import { useAchievementNotifications } from "@/hooks/useAchievementTrigger";
import { AchievementNotification } from "./AchievementNotification";

/**
 * Provider component that renders achievement notifications
 * Place this at the root of your app (e.g., in App.tsx)
 */
export function AchievementNotificationProvider() {
  const { currentAchievement, dismissCurrent } = useAchievementNotifications();

  if (!currentAchievement) return null;

  return (
    <AchievementNotification
      achievement={currentAchievement}
      onClose={dismissCurrent}
      autoClose={true}
      autoCloseDelay={5000}
    />
  );
}
