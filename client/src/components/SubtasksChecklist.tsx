import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { SubtaskTemplateSelector } from './SubtaskTemplateSelector';
import { BuiltinSubtaskTemplates } from './BuiltinSubtaskTemplates';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Check,
  X,
  ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface Subtask {
  id: number;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  sortOrder: number;
}

interface SubtasksChecklistProps {
  taskId: number;
  subtasks: Subtask[];
  onCreateSubtask: (title: string) => void;
  onUpdateSubtask: (id: number, data: { title?: string; status?: 'not_started' | 'completed' }) => void;
  onDeleteSubtask: (id: number) => void;
  onReorderSubtasks: (subtaskIds: number[]) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function SubtasksChecklist({
  taskId,
  subtasks,
  onCreateSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
  onRefresh,
  isLoading
}: SubtasksChecklistProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding new
  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Calculate progress
  const completedCount = subtasks.filter(s => s.status === 'completed').length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Handle create
  const handleCreate = () => {
    if (newSubtaskTitle.trim()) {
      onCreateSubtask(newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    }
  };

  // Handle toggle status
  const handleToggle = (subtask: Subtask) => {
    const newStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
    onUpdateSubtask(subtask.id, { status: newStatus });
  };

  // Handle edit save
  const handleEditSave = (id: number) => {
    if (editingTitle.trim()) {
      onUpdateSubtask(id, { title: editingTitle.trim() });
    }
    setEditingId(null);
    setEditingTitle('');
  };

  // Handle reorder
  const handleReorder = (newOrder: Subtask[]) => {
    onReorderSubtasks(newOrder.map(s => s.id));
  };

  // Sort subtasks by sortOrder
  const sortedSubtasks = [...subtasks].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Подзадачи</span>
          {totalCount > 0 && (
            <span className="text-xs text-slate-500">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <BuiltinSubtaskTemplates
            taskId={taskId}
            onApplied={() => onRefresh?.()}
            compact
          />
          <SubtaskTemplateSelector
            taskId={taskId}
            currentSubtasks={subtasks.map(s => ({ title: s.title }))}
            onApplyTemplate={() => onRefresh?.()}
          />
          {!isAddingNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingNew(true)}
              className="h-7 px-2 text-xs text-slate-400 hover:text-white"
            >
              <Plus className="w-3 h-3 mr-1" />
              Добавить
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <Progress 
            value={progressPercent} 
            className="h-1.5 bg-slate-700"
          />
          <p className="text-[10px] text-slate-500 text-right">
            {progressPercent}% выполнено
          </p>
        </div>
      )}

      {/* Subtasks list with drag and drop */}
      <Reorder.Group
        axis="y"
        values={sortedSubtasks}
        onReorder={handleReorder}
        className="space-y-1"
      >
        <AnimatePresence mode="popLayout">
          {sortedSubtasks.map((subtask) => (
            <Reorder.Item
              key={subtask.id}
              value={subtask}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-lg transition-colors",
                subtask.status === 'completed' 
                  ? "bg-emerald-500/10" 
                  : "bg-slate-800/50 hover:bg-slate-800"
              )}
            >
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400">
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Checkbox */}
              <Checkbox
                checked={subtask.status === 'completed'}
                onCheckedChange={() => handleToggle(subtask)}
                className={cn(
                  "border-slate-600",
                  subtask.status === 'completed' && "bg-emerald-500 border-emerald-500"
                )}
              />

              {/* Title (editable) */}
              {editingId === subtask.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(subtask.id);
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingTitle('');
                      }
                    }}
                    className="h-7 text-sm bg-slate-700 border-slate-600"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-400"
                    onClick={() => handleEditSave(subtask.id)}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400"
                    onClick={() => {
                      setEditingId(null);
                      setEditingTitle('');
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <span
                  className={cn(
                    "flex-1 text-sm cursor-pointer",
                    subtask.status === 'completed' 
                      ? "text-slate-500 line-through" 
                      : "text-slate-300"
                  )}
                  onClick={() => {
                    setEditingId(subtask.id);
                    setEditingTitle(subtask.title);
                  }}
                >
                  {subtask.title}
                </span>
              )}

              {/* Delete button */}
              {editingId !== subtask.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  onClick={() => onDeleteSubtask(subtask.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Add new subtask input */}
      <AnimatePresence>
        {isAddingNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsAddingNew(false);
                  setNewSubtaskTitle('');
                }
              }}
              placeholder="Название подзадачи..."
              className="h-8 text-sm bg-slate-800 border-slate-700"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-400 hover:text-emerald-300"
              onClick={handleCreate}
              disabled={!newSubtaskTitle.trim()}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400"
              onClick={() => {
                setIsAddingNew(false);
                setNewSubtaskTitle('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state with builtin templates */}
      {subtasks.length === 0 && !isAddingNew && (
        <div className="space-y-3">
          <button
            onClick={() => setIsAddingNew(true)}
            className="w-full py-3 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors text-sm"
          >
            <Plus className="w-4 h-4 mx-auto mb-1" />
            Добавить подзадачу вручную
          </button>
          <BuiltinSubtaskTemplates
            taskId={taskId}
            onApplied={() => onRefresh?.()}
          />
        </div>
      )}
    </div>
  );
}

// Compact progress indicator for task list
interface SubtaskProgressProps {
  completed: number;
  total: number;
}

export function SubtaskProgress({ completed, total }: SubtaskProgressProps) {
  if (total === 0) return null;

  const percent = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 rounded-full bg-slate-700 overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all",
            percent === 100 ? "bg-emerald-500" : "bg-amber-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn(
        "text-[10px] font-medium",
        percent === 100 ? "text-emerald-400" : "text-slate-400"
      )}>
        {completed}/{total}
      </span>
    </div>
  );
}
