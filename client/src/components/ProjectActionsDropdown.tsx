/**
 * ProjectActionsDropdown - Dropdown menu with project actions
 * Extracted from ProjectView.tsx
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  FileDown,
  Download,
  Cloud,
  FileText,
  Calendar,
  Bookmark,
  BarChart3,
  Tag,
  Settings,
  Sparkles,
  AlertTriangle,
  LayoutTemplate,
  Presentation,
  Layers,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectActionsDropdownProps {
  projectId: number;
  onNavigate: (path: string) => void;
  onSaveToDrive: () => void;
  onExportToGoogleDocs: () => void;
  onOpenCalendar: () => void;
  onOpenCustomFields: () => void;
  onOpenAIAssistant: () => void;
  onOpenRiskPanel: () => void;
  onOpenSaveTemplate: () => void;
  onOpenPitchDeck: () => void;
  onDeleteProject: () => void;
  isSavingToDrive: boolean;
  isExportingToGoogleDocs: boolean;
  onSaveToNotebookLM: () => Promise<void>;
}

export function ProjectActionsDropdown({
  projectId,
  onNavigate,
  onSaveToDrive,
  onExportToGoogleDocs,
  onOpenCalendar,
  onOpenCustomFields,
  onOpenAIAssistant,
  onOpenRiskPanel,
  onOpenSaveTemplate,
  onOpenPitchDeck,
  onDeleteProject,
  isSavingToDrive,
  isExportingToGoogleDocs,
  onSaveToNotebookLM,
}: ProjectActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-400 flex-shrink-0">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-800 border-slate-700">
        <DropdownMenuItem className="text-slate-300">
          <Edit className="w-4 h-4 mr-2" />
          Редактировать
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Export options */}
        <DropdownMenuItem
          className="text-slate-300"
          onClick={() => {
            window.open(`/api/export/markdown/${projectId}`, '_blank');
            toast.success('Экспорт в Markdown начат');
          }}
        >
          <FileDown className="w-4 h-4 mr-2" />
          Экспорт в Markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-slate-300"
          onClick={() => {
            window.open(`/api/export/html/${projectId}`, '_blank');
            toast.success('Экспорт в HTML начат');
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Экспорт в HTML/PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Google integrations */}
        <DropdownMenuItem
          className="text-blue-400"
          onClick={onSaveToDrive}
          disabled={isSavingToDrive}
        >
          <Cloud className="w-4 h-4 mr-2" />
          {isSavingToDrive ? 'Сохранение...' : 'Сохранить в Google Drive'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-purple-400"
          onClick={onExportToGoogleDocs}
          disabled={isExportingToGoogleDocs}
        >
          <FileText className="w-4 h-4 mr-2" />
          {isExportingToGoogleDocs ? 'Экспорт...' : 'Экспорт в Google Docs'}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-emerald-400" onClick={onOpenCalendar}>
          <Calendar className="w-4 h-4 mr-2" />
          Добавить в Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-orange-400"
          onClick={onSaveToNotebookLM}
          disabled={isSavingToDrive}
        >
          <Bookmark className="w-4 h-4 mr-2" />
          Создать источник в NotebookLM
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Project tools */}
        <DropdownMenuItem
          className="text-cyan-400"
          onClick={() => onNavigate(`/project/${projectId}/analytics`)}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Аналитика
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-indigo-400"
          onClick={() => onNavigate(`/project/${projectId}/tags`)}
        >
          <Tag className="w-4 h-4 mr-2" />
          Управление тегами
        </DropdownMenuItem>
        <DropdownMenuItem className="text-teal-400" onClick={onOpenCustomFields}>
          <Settings className="w-4 h-4 mr-2" />
          Кастомные поля
        </DropdownMenuItem>
        <DropdownMenuItem className="text-pink-400" onClick={onOpenAIAssistant}>
          <Sparkles className="w-4 h-4 mr-2" />
          AI Ассистент
        </DropdownMenuItem>
        <DropdownMenuItem className="text-orange-400" onClick={onOpenRiskPanel}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          Анализ рисков
        </DropdownMenuItem>
        <DropdownMenuItem className="text-violet-400" onClick={onOpenSaveTemplate}>
          <LayoutTemplate className="w-4 h-4 mr-2" />
          Сохранить как шаблон
        </DropdownMenuItem>
        <DropdownMenuItem className="text-amber-400" onClick={onOpenPitchDeck}>
          <Presentation className="w-4 h-4 mr-2" />
          Создать Pitch Deck
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Views */}
        <DropdownMenuItem
          className="text-cyan-400"
          onClick={() => onNavigate(`/project/${projectId}/views`)}
        >
          <Layers className="w-4 h-4 mr-2" />
          Альтернативные виды
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Delete */}
        <DropdownMenuItem className="text-red-400" onClick={onDeleteProject}>
          <Trash2 className="w-4 h-4 mr-2" />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
