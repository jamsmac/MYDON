/**
 * Project-related constants
 * Extracted from ProjectView.tsx for reusability
 */

import { Circle, Clock, CheckCircle2 } from "lucide-react";

// Task status options for dropdown selects
export const TASK_STATUS_OPTIONS = [
  { value: 'not_started' as const, label: 'Не начато', icon: Circle, color: 'text-slate-500' },
  { value: 'in_progress' as const, label: 'В работе', icon: Clock, color: 'text-amber-500' },
  { value: 'completed' as const, label: 'Готово', icon: CheckCircle2, color: 'text-emerald-500' },
] as const;

export type TaskStatusValue = typeof TASK_STATUS_OPTIONS[number]['value'];

// Risk severity colors for styling
export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 border-red-500 text-red-400',
  high: 'bg-orange-500/20 border-orange-500 text-orange-400',
  medium: 'bg-amber-500/20 border-amber-500 text-amber-400',
  low: 'bg-blue-500/20 border-blue-500 text-blue-400',
};

// Risk severity labels (Russian)
export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

// Task priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-amber-500',
  low: 'text-blue-500',
};

// Task priority labels (Russian)
export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

// Helper to get status option by value
export function getStatusOption(value: string | null | undefined) {
  return TASK_STATUS_OPTIONS.find(s => s.value === value) || TASK_STATUS_OPTIONS[0];
}

// Status config for TableView (keyed by status value)
export const STATUS_CONFIG = {
  not_started: { label: 'Не начато', icon: Circle, color: 'text-slate-400' },
  in_progress: { label: 'В работе', icon: Clock, color: 'text-amber-400' },
  completed: { label: 'Готово', icon: CheckCircle2, color: 'text-emerald-400' },
} as const;

// Priority config for TableView (keyed by priority value)
export const PRIORITY_CONFIG = {
  critical: { label: 'Критический', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: 'Высокий', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { label: 'Средний', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low: { label: 'Низкий', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
} as const;
