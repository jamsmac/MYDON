import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sparkles, FolderKanban, Crown, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export function UsageStats() {
  const { data: stats, isLoading } = trpc.limits.getUsageStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const isUnlimitedProjects = stats.projectLimit === -1;
  const isUnlimitedAi = stats.aiRequestsLimit === -1;
  
  const projectProgress = isUnlimitedProjects 
    ? 0 
    : (stats.projectCount / stats.projectLimit) * 100;
  const aiProgress = isUnlimitedAi 
    ? 0 
    : (stats.aiRequestsToday / stats.aiRequestsLimit) * 100;

  const aiRemaining = isUnlimitedAi 
    ? '∞' 
    : Math.max(0, stats.aiRequestsLimit - stats.aiRequestsToday);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-slate-400 hover:text-white"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm">{aiRemaining}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-900 border-slate-700" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Использование</h4>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 capitalize">
              {stats.plan}
            </span>
          </div>

          {/* Projects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <FolderKanban className="w-4 h-4" />
                Проекты
              </div>
              <span className="text-white">
                {stats.projectCount} / {isUnlimitedProjects ? '∞' : stats.projectLimit}
              </span>
            </div>
            {!isUnlimitedProjects && (
              <Progress 
                value={projectProgress} 
                className="h-2 bg-slate-800"
              />
            )}
          </div>

          {/* AI Requests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles className="w-4 h-4" />
                AI запросы (сегодня)
              </div>
              <span className="text-white">
                {stats.aiRequestsToday} / {isUnlimitedAi ? '∞' : stats.aiRequestsLimit}
              </span>
            </div>
            {!isUnlimitedAi && (
              <Progress 
                value={aiProgress} 
                className="h-2 bg-slate-800"
              />
            )}
          </div>

          {/* Upgrade prompt for free users */}
          {stats.plan === 'free' && (
            <div className="pt-2 border-t border-slate-700">
              <Link href="/pricing">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Перейти на Pro
                </Button>
              </Link>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
