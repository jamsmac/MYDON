import { cn } from "@/lib/utils";
import { Trophy, Medal, Award, Flame, Target } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LeaderboardEntry {
  odUserId: number;
  totalPoints: number;
  tasksCompleted: number;
  currentStreak: number;
  level: number;
  rank: number;
  name?: string;
  avatar?: string;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  className?: string;
}

export function Leaderboard({
  entries,
  currentUserId,
  className,
}: LeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-700" />;
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">
            {rank}
          </span>
        );
    }
  };

  const getRankBgClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/30";
      case 2:
        return "bg-gradient-to-r from-slate-400/10 to-slate-500/5 border-slate-400/30";
      case 3:
        return "bg-gradient-to-r from-amber-700/10 to-amber-800/5 border-amber-700/30";
      default:
        return "bg-card border-border";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {entries.map((entry) => {
        const isCurrentUser = entry.odUserId === currentUserId;

        return (
          <div
            key={entry.odUserId}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg border transition-all",
              getRankBgClass(entry.rank),
              isCurrentUser && "ring-2 ring-primary/50"
            )}
          >
            {/* Rank */}
            <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>

            {/* User Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {entry.name?.charAt(0) || `U${entry.odUserId}`}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {entry.name || `User ${entry.odUserId}`}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-primary">(You)</span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {entry.tasksCompleted} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-500" />
                    {entry.currentStreak} day streak
                  </span>
                </div>
              </div>
            </div>

            {/* Level & Points */}
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {entry.level}
                </div>
                <span className="font-bold text-lg">{entry.totalPoints}</span>
              </div>
              <p className="text-xs text-muted-foreground">points</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact leaderboard for sidebar
interface CompactLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  limit?: number;
  className?: string;
}

export function CompactLeaderboard({
  entries,
  currentUserId,
  limit = 5,
  className,
}: CompactLeaderboardProps) {
  const displayEntries = entries.slice(0, limit);

  return (
    <div className={cn("space-y-1", className)}>
      {displayEntries.map((entry) => {
        const isCurrentUser = entry.odUserId === currentUserId;

        return (
          <div
            key={entry.odUserId}
            className={cn(
              "flex items-center gap-2 p-2 rounded text-sm",
              isCurrentUser && "bg-primary/10"
            )}
          >
            <span
              className={cn(
                "w-5 text-center font-medium",
                entry.rank === 1 && "text-amber-500",
                entry.rank === 2 && "text-slate-400",
                entry.rank === 3 && "text-amber-700"
              )}
            >
              {entry.rank}
            </span>
            <span className="flex-1 truncate">
              {entry.name || `User ${entry.odUserId}`}
            </span>
            <span className="font-medium">{entry.totalPoints}</span>
          </div>
        );
      })}
    </div>
  );
}
