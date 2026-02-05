import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Coins, Zap, TrendingUp, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

export function CreditsWidget() {
  const { data: credits, isLoading } = trpc.credits.balance.useQuery();
  const { data: history } = trpc.credits.history.useQuery({ limit: 5 });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!credits) return null;

  const creditLevel = credits.credits > 500 ? 'high' : credits.credits > 100 ? 'medium' : 'low';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 h-auto rounded-lg transition-colors",
            creditLevel === 'high' && "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400",
            creditLevel === 'medium' && "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400",
            creditLevel === 'low' && "bg-red-500/10 hover:bg-red-500/20 text-red-400"
          )}
        >
          <Coins className="w-4 h-4" />
          <span className="font-mono font-semibold">{credits.credits}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-700 p-0" align="end">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Баланс кредитов</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded",
              credits.useBYOK ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
              {credits.useBYOK ? 'BYOK режим' : 'Platform режим'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{credits.credits}</span>
            <span className="text-slate-500">кредитов</span>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                creditLevel === 'high' && "bg-emerald-500",
                creditLevel === 'medium' && "bg-amber-500",
                creditLevel === 'low' && "bg-red-500"
              )}
              style={{ width: `${Math.min(100, (credits.credits / 1000) * 100)}%` }}
            />
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-400">Получено:</span>
              <span className="text-white font-mono">{credits.totalEarned}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-slate-400">Потрачено:</span>
              <span className="text-white font-mono">{credits.totalSpent}</span>
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        {history && history.length > 0 && (
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Последние операции</span>
            </div>
            <div className="space-y-2">
              {history.slice(0, 3).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate max-w-[180px]">
                    {tx.description || tx.type}
                  </span>
                  <span className={cn(
                    "font-mono",
                    tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Link href="/settings">
            <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
              Настройки AI
            </Button>
          </Link>
          {credits.credits < 100 && (
            <p className="text-xs text-center text-slate-500">
              Кредиты заканчиваются? Включите BYOK режим в настройках
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact version for showing after AI responses
export function CreditUsageIndicator({ 
  creditsUsed, 
  model, 
  reason 
}: { 
  creditsUsed: number; 
  model?: string | null; 
  reason?: string;
}) {
  if (creditsUsed === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-purple-400 mt-2">
        <Zap className="w-3 h-3" />
        <span>BYOK режим — без списания кредитов</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
      <Coins className="w-3 h-3" />
      <span>
        {model && <span className="text-slate-400">{model}</span>}
        {' • '}
        <span className="text-amber-400">-{creditsUsed} кредитов</span>
        {reason && <span className="hidden sm:inline"> • {reason}</span>}
      </span>
    </div>
  );
}
