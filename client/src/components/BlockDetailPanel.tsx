import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Layers,
  FolderOpen,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Calendar,
  BarChart3,
  AlertTriangle,
  Edit,
  Loader2,
} from "lucide-react";
import { QuickActionsBar } from "./QuickActionsBar";
import { DiscussionPanel } from "./DiscussionPanel";
import { BreadcrumbNav } from "./BreadcrumbNav";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface BlockSection {
  id: number;
  title: string;
  tasks?: Array<{
    id: number;
    title: string;
    status: string | null;
    priority?: string | null;
    deadline?: string | Date | null;
  }>;
}

interface BlockData {
  id: number;
  title: string;
  titleRu?: string | null;
  description?: string | null;
  icon?: string | null;
  duration?: string | null;
  deadline?: string | Date | null;
  number: number;
  sections?: BlockSection[];
}

interface BlockDetailPanelProps {
  block: BlockData;
  projectId: number;
  projectName: string;
  onSelectSection: (sectionId: number, sectionTitle: string) => void;
  onSelectTask: (taskId: number, taskTitle: string, sectionId: number) => void;
  onCreateSection: (blockId: number) => void;
  onNavigate: (item: { type: "project" | "block" | "section" | "task"; id: number; title: string }) => void;
  onMarkRead?: (entityType: string, entityId: number) => void;
}

export function BlockDetailPanel({
  block,
  projectId,
  projectName,
  onSelectSection,
  onSelectTask,
  onCreateSection,
  onNavigate,
  onMarkRead,
}: BlockDetailPanelProps) {
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Calculate block statistics
  const stats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let notStartedTasks = 0;
    let overdueTasks = 0;
    const now = new Date();

    block.sections?.forEach((section) => {
      section.tasks?.forEach((task) => {
        totalTasks++;
        if (task.status === "completed") completedTasks++;
        else if (task.status === "in_progress") inProgressTasks++;
        else notStartedTasks++;

        if (task.deadline && task.status !== "completed") {
          const deadline = new Date(task.deadline);
          if (deadline < now) overdueTasks++;
        }
      });
    });

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalTasks, completedTasks, inProgressTasks, notStartedTasks, overdueTasks, progress };
  }, [block]);

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const breadcrumbs = [
    { type: "project" as const, id: projectId, title: projectName },
    { type: "block" as const, id: block.id, title: block.titleRu || block.title },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <BreadcrumbNav items={breadcrumbs} onNavigate={onNavigate} />

      {/* Block Header */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span className="truncate">{block.titleRu || block.title}</span>
            </h2>
            {block.titleRu && block.title !== block.titleRu && (
              <p className="text-sm text-slate-400 mt-0.5 ml-7">{block.title}</p>
            )}
          </div>
          <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs flex-shrink-0">
            Блок #{block.number}
          </Badge>
        </div>

        {block.description && (
          <p className="text-sm text-slate-400 mt-2 ml-7">{block.description}</p>
        )}

        {/* Meta info row */}
        <div className="flex flex-wrap gap-3 mt-3 ml-7">
          {block.duration && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{block.duration}</span>
            </div>
          )}
          {block.deadline && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(block.deadline), "d MMM yyyy", { locale: ru })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Прогресс</span>
            <span className="text-sm font-bold text-amber-400">{stats.progress}%</span>
          </div>
          <Progress value={stats.progress} className="h-2 mb-3" />
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.totalTasks}</div>
              <div className="text-[10px] text-slate-500">Всего</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">{stats.completedTasks}</div>
              <div className="text-[10px] text-slate-500">Готово</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400">{stats.inProgressTasks}</div>
              <div className="text-[10px] text-slate-500">В работе</div>
            </div>
            <div className="text-center">
              <div className={cn("text-lg font-bold", stats.overdueTasks > 0 ? "text-red-400" : "text-slate-500")}>
                {stats.overdueTasks}
              </div>
              <div className="text-[10px] text-slate-500">Просрочено</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={showDiscussion ? "default" : "outline"}
          size="sm"
          className={cn(
            showDiscussion
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "border-slate-600 text-blue-400 hover:bg-blue-500/10"
          )}
          onClick={() => {
            setShowDiscussion(!showDiscussion);
            if (!showDiscussion && onMarkRead) {
              onMarkRead("block", block.id);
            }
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Обсудить
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300"
          onClick={() => onCreateSection(block.id)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить раздел
        </Button>
      </div>

      {/* AI Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-slate-400">Быстрые действия AI</span>
        </div>
        <QuickActionsBar
          entityType="block"
          entityId={block.id}
          projectId={projectId}
          onInsertResult={(content) => {
            navigator.clipboard.writeText(content);
            toast.success("Скопировано в буфер обмена");
          }}
          compact
        />
      </div>

      {/* Discussion Panel */}
      {showDiscussion && (
        <DiscussionPanel
          entityType="block"
          entityId={block.id}
          entityTitle={block.titleRu || block.title}
          projectId={projectId}
        />
      )}

      {/* Sections List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            Разделы ({block.sections?.length || 0})
          </h3>
        </div>
        <div className="space-y-2">
          {block.sections && block.sections.length > 0 ? (
            block.sections.map((section) => {
              const sectionTasks = section.tasks || [];
              const sectionCompleted = sectionTasks.filter((t) => t.status === "completed").length;
              const sectionTotal = sectionTasks.length;
              const sectionProgress = sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;
              const isExpanded = expandedSections.has(section.id);

              return (
                <Card
                  key={section.id}
                  className="bg-slate-800/40 border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <CardContent className="py-0 px-0">
                    {/* Section Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => onSelectSection(section.id, section.title)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section.id);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <ChevronRight
                          className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")}
                        />
                      </button>
                      <FolderOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-200 font-medium truncate block">
                          {section.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">
                            {sectionCompleted}/{sectionTotal} задач
                          </span>
                          {sectionTotal > 0 && (
                            <div className="flex-1 max-w-[80px]">
                              <Progress value={sectionProgress} className="h-1" />
                            </div>
                          )}
                          <span className="text-[10px] text-slate-500">{sectionProgress}%</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>

                    {/* Expanded Tasks */}
                    {isExpanded && sectionTasks.length > 0 && (
                      <div className="border-t border-slate-700/50 px-4 py-2 space-y-1">
                        {sectionTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors"
                            onClick={() => onSelectTask(task.id, task.title, section.id)}
                          >
                            {task.status === "completed" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            ) : task.status === "in_progress" ? (
                              <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-xs flex-1 truncate",
                                task.status === "completed" ? "text-slate-500 line-through" : "text-slate-300"
                              )}
                            >
                              {task.title}
                            </span>
                            {task.priority === "critical" && (
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            )}
                            {task.priority === "high" && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/30 text-orange-400">
                                high
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-6 text-slate-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Нет разделов</p>
              <p className="text-xs mt-1">Создайте первый раздел для этого блока</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
