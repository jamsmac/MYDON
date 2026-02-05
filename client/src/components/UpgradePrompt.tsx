import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Crown, Sparkles, FolderKanban, Zap } from 'lucide-react';
import { Link } from 'wouter';

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'project' | 'ai';
  currentUsage?: number;
  limit?: number;
}

export function UpgradePrompt({ 
  open, 
  onOpenChange, 
  type, 
  currentUsage, 
  limit 
}: UpgradePromptProps) {
  const isProject = type === 'project';
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
            {isProject ? (
              <FolderKanban className="w-8 h-8 text-amber-500" />
            ) : (
              <Sparkles className="w-8 h-8 text-amber-500" />
            )}
          </div>
          <DialogTitle className="text-center text-xl text-white">
            {isProject ? 'Лимит проектов достигнут' : 'Лимит AI запросов достигнут'}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {isProject ? (
              <>
                Вы создали {currentUsage} из {limit} проектов на бесплатном плане.
                Перейдите на Pro для безлимитных проектов.
              </>
            ) : (
              <>
                Вы использовали {currentUsage} из {limit} AI запросов сегодня.
                Перейдите на Pro для безлимитного использования AI.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Pro план включает:
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Безлимитные проекты
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Безлимитные AI запросы
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Экспорт в PDF и Excel
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Команда до 5 человек
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 border-slate-700"
              onClick={() => onOpenChange(false)}
            >
              Позже
            </Button>
            <Link href="/pricing" className="flex-1">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black">
                Перейти на Pro
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
