import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BadgeProps {
  icon: string;
  name: string;
  description: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date | null;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export function Badge({
  icon,
  name,
  description,
  points,
  unlocked,
  unlockedAt,
  size = "md",
  showTooltip = true,
}: BadgeProps) {
  const sizeClasses = {
    sm: "w-10 h-10 text-lg",
    md: "w-14 h-14 text-2xl",
    lg: "w-20 h-20 text-4xl",
  };

  const badge = (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center transition-all duration-300",
        sizeClasses[size],
        unlocked
          ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30"
          : "bg-slate-700/50 grayscale opacity-50"
      )}
    >
      <span className={cn(unlocked ? "" : "opacity-30")}>{icon}</span>
      {unlocked && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
          <svg
            className="w-3 h-3 text-white"
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
      )}
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="text-center">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-xs text-amber-500 mt-1">+{points} points</p>
          {unlocked && unlockedAt && (
            <p className="text-xs text-emerald-500 mt-1">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface BadgeGridProps {
  achievements: Array<{
    id: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    category: string;
    unlocked: boolean;
    unlockedAt?: Date | null;
  }>;
  size?: "sm" | "md" | "lg";
}

export function BadgeGrid({ achievements, size = "md" }: BadgeGridProps) {
  const categories = ["tasks", "streaks", "projects", "special"];
  const categoryLabels: Record<string, string> = {
    tasks: "Task Achievements",
    streaks: "Streak Achievements",
    projects: "Project Achievements",
    special: "Special Achievements",
  };

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categoryAchievements = achievements.filter(
          (a) => a.category === category
        );
        if (categoryAchievements.length === 0) return null;

        const unlockedCount = categoryAchievements.filter((a) => a.unlocked).length;

        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {categoryLabels[category]}
              </h4>
              <span className="text-xs text-muted-foreground">
                {unlockedCount}/{categoryAchievements.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {categoryAchievements.map((achievement) => (
                <Badge
                  key={achievement.id}
                  icon={achievement.icon}
                  name={achievement.name}
                  description={achievement.description}
                  points={achievement.points}
                  unlocked={achievement.unlocked}
                  unlockedAt={achievement.unlockedAt}
                  size={size}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
