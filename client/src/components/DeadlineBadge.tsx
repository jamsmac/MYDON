import { useDeadlines } from '@/contexts/DeadlineContext';
import { cn } from '@/lib/utils';
import { Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DeadlineBadgeProps {
  blockId: string;
  showDays?: boolean;
  size?: 'sm' | 'md';
}

export function DeadlineBadge({ blockId, showDays = true, size = 'md' }: DeadlineBadgeProps) {
  const { getDeadlineStatus, getDaysRemaining, getBlockDeadline } = useDeadlines();
  
  const status = getDeadlineStatus(blockId);
  const daysRemaining = getDaysRemaining(blockId);
  const deadline = getBlockDeadline(blockId);
  
  if (status === 'no_deadline' || !deadline) return null;

  const getDaysWord = (days: number): string => {
    const absDays = Math.abs(days);
    if (absDays === 1) return 'день';
    if (absDays >= 2 && absDays <= 4) return 'дня';
    return 'дней';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const config = {
    overdue: {
      icon: AlertTriangle,
      label: daysRemaining !== null 
        ? `Просрочено на ${Math.abs(daysRemaining)} ${getDaysWord(daysRemaining)}`
        : 'Просрочено',
      className: 'bg-red-100 text-red-700 border-red-200',
      iconClassName: 'text-red-500',
    },
    due_soon: {
      icon: Clock,
      label: daysRemaining === 0 
        ? 'Сегодня!' 
        : `${daysRemaining} ${getDaysWord(daysRemaining!)}`,
      className: 'bg-amber-100 text-amber-700 border-amber-200',
      iconClassName: 'text-amber-500',
    },
    on_track: {
      icon: Calendar,
      label: showDays && daysRemaining !== null 
        ? `${daysRemaining} ${getDaysWord(daysRemaining)}`
        : formatDate(deadline.deadline),
      className: 'bg-slate-100 text-slate-600 border-slate-200',
      iconClassName: 'text-slate-500',
    },
    no_deadline: {
      icon: Calendar,
      label: '',
      className: '',
      iconClassName: '',
    },
  };

  const { icon: Icon, label, className, iconClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1 font-normal',
        className,
        size === 'sm' && 'text-xs px-1.5 py-0.5'
      )}
    >
      <Icon className={cn(
        iconClassName,
        size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
      )} />
      {label}
    </Badge>
  );
}

interface DeadlineIndicatorProps {
  blockId: string;
}

export function DeadlineIndicator({ blockId }: DeadlineIndicatorProps) {
  const { getDeadlineStatus } = useDeadlines();
  const status = getDeadlineStatus(blockId);
  
  if (status === 'no_deadline') return null;

  const colors = {
    overdue: 'bg-red-500',
    due_soon: 'bg-amber-500',
    on_track: 'bg-slate-400',
  };

  return (
    <span 
      className={cn(
        'w-2 h-2 rounded-full animate-pulse',
        colors[status]
      )} 
    />
  );
}
