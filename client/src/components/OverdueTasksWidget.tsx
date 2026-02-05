import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  ChevronRight,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface OverdueTask {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  deadline: Date | string;
  daysOverdue: number;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
}

interface OverdueTasksWidgetProps {
  tasks: OverdueTask[];
  onTaskClick?: (taskId: number, projectId: number) => void;
  onMarkComplete?: (taskId: number) => void;
  onRescheduleToday?: (taskId: number) => void;
  className?: string;
}

export function OverdueTasksWidget({ 
  tasks, 
  onTaskClick, 
  onMarkComplete, 
  onRescheduleToday,
  className 
}: OverdueTasksWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tasks.length === 0) {
    return null;
  }

  const displayTasks = isExpanded ? tasks : tasks.slice(0, 3);

  return (
    <Card className={cn("bg-red-500/10 border-red-500/30", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-red-400 text-base">
                Просроченные задачи
              </CardTitle>
              <p className="text-xs text-red-400/70">
                {tasks.length} {tasks.length === 1 ? 'задача' : tasks.length < 5 ? 'задачи' : 'задач'}
              </p>
            </div>
          </div>
          {tasks.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
            >
              {isExpanded ? 'Свернуть' : `Ещё ${tasks.length - 3}`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <ScrollArea className={cn(isExpanded && tasks.length > 5 ? "h-[300px]" : "")}>
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {displayTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  {/* Priority indicator */}
                  <div className={cn(
                    "w-1 h-8 rounded-full flex-shrink-0",
                    task.priority === 'critical' ? "bg-red-500" :
                    task.priority === 'high' ? "bg-orange-500" :
                    task.priority === 'medium' ? "bg-yellow-500" :
                    "bg-slate-500"
                  )} />

                  {/* Task info */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onTaskClick?.(task.id, task.projectId)}
                  >
                    <p className="text-sm text-white truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="truncate">{task.projectName}</span>
                      <span>•</span>
                      <span className="text-red-400 font-medium whitespace-nowrap">
                        {task.daysOverdue === 1 
                          ? 'Просрочено на 1 день' 
                          : `Просрочено на ${task.daysOverdue} дней`}
                      </span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkComplete?.(task.id);
                      }}
                      title="Отметить выполненной"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRescheduleToday?.(task.id);
                      }}
                      title="Перенести на сегодня"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      onClick={() => onTaskClick?.(task.id, task.projectId)}
                      title="Открыть задачу"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Header indicator component
interface OverdueIndicatorProps {
  count: number;
  onClick?: () => void;
}

export function OverdueHeaderIndicator({ count, onClick }: OverdueIndicatorProps) {
  if (count === 0) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{count}</span>
      <span className="text-xs hidden sm:inline">просрочено</span>
    </motion.button>
  );
}

// Hook to calculate overdue tasks from projects
export function useOverdueTasks(projects: {
  id: number;
  name: string;
  blocks?: {
    sections?: {
      tasks?: {
        id: number;
        title: string;
        status: string | null;
        deadline?: Date | string | null;
        priority?: string | null;
      }[];
    }[];
  }[];
}[]): OverdueTask[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdueTasks: OverdueTask[] = [];

  projects.forEach(project => {
    project.blocks?.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          if (task.deadline && task.status !== 'completed') {
            const deadline = new Date(task.deadline);
            const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
            const daysOverdue = differenceInDays(today, deadlineDay);

            if (daysOverdue > 0) {
              overdueTasks.push({
                id: task.id,
                title: task.title,
                projectId: project.id,
                projectName: project.name,
                deadline: task.deadline,
                daysOverdue,
                priority: task.priority as any,
              });
            }
          }
        });
      });
    });
  });

  // Sort by days overdue (most overdue first) then by priority
  return overdueTasks.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) {
      return b.daysOverdue - a.daysOverdue;
    }
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return (priorityOrder[b.priority || 'medium'] || 2) - (priorityOrder[a.priority || 'medium'] || 2);
  });
}
