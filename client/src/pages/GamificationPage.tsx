import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { UserStatsCard } from "@/components/gamification/UserStatsCard";
import { BadgeGrid } from "@/components/gamification/Badge";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { useAuth } from "@/_core/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Target, Flame, Star, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
  unlocked: boolean;
  unlockedAt: Date | null;
}

export default function GamificationPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = trpc.gamification.getStats.useQuery();
  const { data: achievements, isLoading: achievementsLoading } = trpc.gamification.getAchievements.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading } = trpc.gamification.getLeaderboard.useQuery({ limit: 10 });

  const unlockedCount = achievements?.filter((a: Achievement) => a.unlocked).length || 0;
  const totalAchievements = achievements?.length || 0;

  // Transform stats to handle null values
  const normalizedStats = stats ? {
    tasksCompleted: stats.tasksCompleted ?? 0,
    projectsCompleted: stats.projectsCompleted ?? 0,
    currentStreak: stats.currentStreak ?? 0,
    longestStreak: stats.longestStreak ?? 0,
    totalPoints: stats.totalPoints ?? 0,
    level: stats.level,
    nextLevelPoints: stats.nextLevelPoints,
  } : null;

  // Transform leaderboard to handle null values
  const normalizedLeaderboard = leaderboard?.map(entry => ({
    odUserId: entry.odUserId,
    totalPoints: entry.totalPoints ?? 0,
    tasksCompleted: entry.tasksCompleted ?? 0,
    currentStreak: entry.currentStreak ?? 0,
    level: entry.level,
    rank: entry.rank,
  })) || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" />
              Achievements & Progress
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and earn achievements
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        {statsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : normalizedStats ? (
          <UserStatsCard stats={normalizedStats} />
        ) : null}

        {/* Tabs for Achievements and Leaderboard */}
        <Tabs defaultValue="achievements" className="space-y-4">
          <TabsList>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Medal className="w-4 h-4" />
              Achievements
              <span className="ml-1 text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                {unlockedCount}/{totalAchievements}
              </span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achievements">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Your Achievements
                </CardTitle>
                <CardDescription>
                  Complete tasks and reach milestones to unlock achievements and earn points
                </CardDescription>
              </CardHeader>
              <CardContent>
                {achievementsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : achievements ? (
                  <BadgeGrid achievements={achievements} size="md" />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No achievements available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Achievement Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <SummaryCard
                icon={<Target className="w-5 h-5 text-emerald-500" />}
                label="Task Achievements"
                value={achievements?.filter((a: Achievement) => a.category === "tasks" && a.unlocked).length || 0}
                total={achievements?.filter((a: Achievement) => a.category === "tasks").length || 0}
                color="emerald"
              />
              <SummaryCard
                icon={<Flame className="w-5 h-5 text-orange-500" />}
                label="Streak Achievements"
                value={achievements?.filter((a: Achievement) => a.category === "streaks" && a.unlocked).length || 0}
                total={achievements?.filter((a: Achievement) => a.category === "streaks").length || 0}
                color="orange"
              />
              <SummaryCard
                icon={<Trophy className="w-5 h-5 text-amber-500" />}
                label="Project Achievements"
                value={achievements?.filter((a: Achievement) => a.category === "projects" && a.unlocked).length || 0}
                total={achievements?.filter((a: Achievement) => a.category === "projects").length || 0}
                color="amber"
              />
              <SummaryCard
                icon={<Star className="w-5 h-5 text-purple-500" />}
                label="Special Achievements"
                value={achievements?.filter((a: Achievement) => a.category === "special" && a.unlocked).length || 0}
                total={achievements?.filter((a: Achievement) => a.category === "special").length || 0}
                color="purple"
              />
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>
                  See how you rank against other users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : normalizedLeaderboard.length > 0 ? (
                  <Leaderboard
                    entries={normalizedLeaderboard}
                    currentUserId={user?.id}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No leaderboard data available yet. Complete tasks to appear on the leaderboard!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: "emerald" | "orange" | "amber" | "purple";
}

function SummaryCard({ icon, label, value, total, color }: SummaryCardProps) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    orange: "bg-orange-500/10 border-orange-500/20",
    amber: "bg-amber-500/10 border-amber-500/20",
    purple: "bg-purple-500/10 border-purple-500/20",
  };

  return (
    <Card className={colorClasses[color]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">
              {value}/{total}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
