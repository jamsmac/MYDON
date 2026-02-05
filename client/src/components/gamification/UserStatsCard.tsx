import { cn } from "@/lib/utils";
import { Trophy, Flame, Target, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UserStats {
  tasksCompleted: number;
  projectsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  level: number;
  nextLevelPoints: number;
}

interface UserStatsCardProps {
  stats: UserStats;
  className?: string;
}

export function UserStatsCard({ stats, className }: UserStatsCardProps) {
  const pointsInCurrentLevel = stats.totalPoints % 100;
  const progressToNextLevel = (pointsInCurrentLevel / 100) * 100;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-6 space-y-6",
        className
      )}
    >
      {/* Level and Points */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">{stats.level}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Level {stats.level}</p>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={progressToNextLevel} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground">
              {pointsInCurrentLevel}/100
            </span>
          </div>
          <p className="text-lg font-bold text-foreground mt-1">
            {stats.totalPoints} total points
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatItem
          icon={<Target className="w-5 h-5 text-emerald-500" />}
          label="Tasks Completed"
          value={stats.tasksCompleted}
          color="emerald"
        />
        <StatItem
          icon={<Trophy className="w-5 h-5 text-amber-500" />}
          label="Projects Done"
          value={stats.projectsCompleted}
          color="amber"
        />
        <StatItem
          icon={<Flame className="w-5 h-5 text-orange-500" />}
          label="Current Streak"
          value={`${stats.currentStreak} days`}
          color="orange"
        />
        <StatItem
          icon={<Star className="w-5 h-5 text-purple-500" />}
          label="Best Streak"
          value={`${stats.longestStreak} days`}
          color="purple"
        />
      </div>
    </div>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "emerald" | "amber" | "orange" | "purple";
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    amber: "bg-amber-500/10 border-amber-500/20",
    orange: "bg-orange-500/10 border-orange-500/20",
    purple: "bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex items-center gap-3",
        colorClasses[color]
      )}
    >
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

// Compact version for sidebar/header
interface CompactStatsProps {
  stats: UserStats;
  className?: string;
}

export function CompactStats({ stats, className }: CompactStatsProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
          {stats.level}
        </div>
        <span className="text-sm font-medium">{stats.totalPoints} pts</span>
      </div>
      <div className="flex items-center gap-1 text-orange-500">
        <Flame className="w-4 h-4" />
        <span className="text-sm font-medium">{stats.currentStreak}</span>
      </div>
    </div>
  );
}
