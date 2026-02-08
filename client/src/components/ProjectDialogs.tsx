/**
 * ProjectDialogs - All project-level dialogs extracted from ProjectView
 * Includes: CreateSection, SmartTaskCreator, Calendar, Template, PitchDeck,
 * AI Assistant, Risk Analysis, Custom Fields, and Task Management dialogs
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreateSectionDialog } from '@/components/CreateEntityDialogs';
import { SmartTaskCreator } from '@/components/SmartTaskCreator';
import { CalendarDialog } from '@/components/CalendarDialog';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import { PitchDeckGenerator } from '@/components/PitchDeckGenerator';
import { StreamingAIChat } from '@/components/StreamingAIChat';
import { RiskAnalysisContent } from '@/components/RiskAnalysisContent';
import CustomFieldsManager from '@/components/CustomFieldsManager';
import {
  SplitTaskDialog,
  MergeTasksDialog,
  ConvertTaskToSectionDialog,
  ConvertSectionToTaskDialog,
  BulkActionsDialog
} from '@/components/TaskManagementDialogs';
import { Sparkles, AlertTriangle, Settings } from 'lucide-react';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  sections?: ProjectSection[];
}

interface ProjectSection {
  id: number;
  title: string;
  tasks?: ProjectTask[];
}

interface ProjectTask {
  id: number;
  title: string;
  description?: string | null;
}

interface TaskForAction {
  id: number;
  title: string;
  sectionId: number;
  status: string | null;
}

interface TaskInSection {
  id: number;
  title: string;
  sectionId: number;
  status: string | null;
}

interface SectionForAction {
  id: number;
  title: string;
  blockId: number;
  tasks: TaskInSection[];
}

interface CreateDialogsState {
  sectionOpen: boolean;
  setSectionOpen: (open: boolean) => void;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  targetBlockId: number | null;
  taskOpen: boolean;
  setTaskOpen: (open: boolean) => void;
  targetSectionId: number | null;
}

interface FeatureDialogsState {
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
  saveTemplateOpen: boolean;
  setSaveTemplateOpen: (open: boolean) => void;
  pitchDeckOpen: boolean;
  setPitchDeckOpen: (open: boolean) => void;
  aiAssistantOpen: boolean;
  setAIAssistantOpen: (open: boolean) => void;
  riskPanelOpen: boolean;
  setRiskPanelOpen: (open: boolean) => void;
  customFieldsOpen: boolean;
  setCustomFieldsOpen: (open: boolean) => void;
}

interface TaskActionDialogsState {
  splitOpen: boolean;
  setSplitOpen: (open: boolean) => void;
  mergeOpen: boolean;
  setMergeOpen: (open: boolean) => void;
  convertToSectionOpen: boolean;
  setConvertToSectionOpen: (open: boolean) => void;
  convertToTaskOpen: boolean;
  setConvertToTaskOpen: (open: boolean) => void;
  bulkActionsOpen: boolean;
  setBulkActionsOpen: (open: boolean) => void;
}

interface ProjectDialogsProps {
  project: {
    id: number;
    name: string;
    blocks: ProjectBlock[];
  };
  projectId: number;
  createDialogs: CreateDialogsState;
  featureDialogs: FeatureDialogsState;
  taskActionDialogs: TaskActionDialogsState;
  selectedTaskForAction: TaskForAction | null;
  selectedSectionForAction: SectionForAction | null;
  selectedTaskIds: number[];
  selectionMode: boolean;
  setSelectedTaskIds: (ids: number[]) => void;
  setSelectionMode: (mode: boolean) => void;
  getContextContent: (type: string, id: number) => string;
  onCreateSection: (blockId: number, title: string) => void;
  onCreateTask: (sectionId: number, task: { title: string; description?: string; priority?: string; dueDate?: number }) => void;
  isCreateSectionPending: boolean;
  isCreateTaskPending: boolean;
  onRefetch: () => void;
}

export function ProjectDialogs({
  project,
  projectId,
  createDialogs,
  featureDialogs,
  taskActionDialogs,
  selectedTaskForAction,
  selectedSectionForAction,
  selectedTaskIds,
  setSelectedTaskIds,
  setSelectionMode,
  getContextContent,
  onCreateSection,
  onCreateTask,
  isCreateSectionPending,
  isCreateTaskPending,
  onRefetch,
}: ProjectDialogsProps) {
  // Get section title for SmartTaskCreator
  const sectionTitle = createDialogs.targetSectionId
    ? project.blocks
        ?.flatMap((b) => b.sections || [])
        .find((s) => s.id === createDialogs.targetSectionId)?.title
    : undefined;

  // Get all tasks for CalendarDialog
  const allTasksForCalendar = project.blocks.flatMap((block) =>
    (block.sections || []).flatMap((section) =>
      (section.tasks || []).map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
      }))
    )
  );

  // Get all sections for ConvertSectionToTaskDialog
  const allSections = project.blocks.flatMap((b) =>
    (b.sections || []).map((s) => ({
      id: s.id,
      title: s.title,
      blockId: b.id,
      tasks: (s.tasks || []).map((t) => ({
        id: t.id,
        title: t.title,
        sectionId: s.id,
        status: null as string | null,
      })),
    }))
  );

  return (
    <>
      {/* Create Section Dialog */}
      <CreateSectionDialog
        open={createDialogs.sectionOpen}
        onOpenChange={createDialogs.setSectionOpen}
        title={createDialogs.sectionTitle}
        onTitleChange={createDialogs.setSectionTitle}
        onSubmit={() => {
          if (!createDialogs.targetBlockId) return;
          onCreateSection(createDialogs.targetBlockId, createDialogs.sectionTitle.trim());
        }}
        isPending={isCreateSectionPending}
      />

      {/* Smart Task Creator */}
      <SmartTaskCreator
        open={createDialogs.taskOpen}
        onClose={() => createDialogs.setTaskOpen(false)}
        sectionId={createDialogs.targetSectionId || 0}
        projectId={projectId}
        sectionTitle={sectionTitle}
        onCreateTask={(task) => {
          if (!createDialogs.targetSectionId) return;
          onCreateTask(createDialogs.targetSectionId, {
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate || undefined,
          });
        }}
        isCreating={isCreateTaskPending}
      />

      {/* Google Calendar Dialog */}
      <CalendarDialog
        open={featureDialogs.calendarOpen}
        onOpenChange={featureDialogs.setCalendarOpen}
        projectId={projectId}
        projectName={project.name}
        tasks={allTasksForCalendar}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={featureDialogs.saveTemplateOpen}
        onOpenChange={featureDialogs.setSaveTemplateOpen}
        projectId={projectId}
        projectName={project.name}
      />

      {/* Pitch Deck Generator */}
      <PitchDeckGenerator
        open={featureDialogs.pitchDeckOpen}
        onOpenChange={featureDialogs.setPitchDeckOpen}
        projectId={projectId}
        projectName={project.name}
      />

      {/* AI Assistant Dialog */}
      <Dialog open={featureDialogs.aiAssistantOpen} onOpenChange={featureDialogs.setAIAssistantOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              AI Ассистент
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Используйте AI для анализа проекта, генерации идей и получения рекомендаций
            </DialogDescription>
          </DialogHeader>
          <div className="h-[500px]">
            <StreamingAIChat
              contextType="project"
              contextId={projectId}
              contextTitle={project.name}
              contextContent={getContextContent('project', projectId)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Detection Panel */}
      <Dialog open={featureDialogs.riskPanelOpen} onOpenChange={featureDialogs.setRiskPanelOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Анализ рисков
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Выявленные риски и проблемы в проекте
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <RiskAnalysisContent projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Fields Manager Dialog */}
      <Dialog open={featureDialogs.customFieldsOpen} onOpenChange={featureDialogs.setCustomFieldsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-teal-400" />
              Кастомные поля
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Создавайте пользовательские поля для задач: текст, числа, даты, формулы и многое другое
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <CustomFieldsManager projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Management Dialogs */}
      <SplitTaskDialog
        open={taskActionDialogs.splitOpen}
        onOpenChange={taskActionDialogs.setSplitOpen}
        task={selectedTaskForAction}
        onSuccess={onRefetch}
      />

      <MergeTasksDialog
        open={taskActionDialogs.mergeOpen}
        onOpenChange={taskActionDialogs.setMergeOpen}
        section={selectedSectionForAction}
        onSuccess={onRefetch}
      />

      <ConvertTaskToSectionDialog
        open={taskActionDialogs.convertToSectionOpen}
        onOpenChange={taskActionDialogs.setConvertToSectionOpen}
        task={selectedTaskForAction}
        onSuccess={onRefetch}
      />

      <ConvertSectionToTaskDialog
        open={taskActionDialogs.convertToTaskOpen}
        onOpenChange={taskActionDialogs.setConvertToTaskOpen}
        section={selectedSectionForAction}
        sections={allSections}
        onSuccess={onRefetch}
      />

      <BulkActionsDialog
        open={taskActionDialogs.bulkActionsOpen}
        onOpenChange={taskActionDialogs.setBulkActionsOpen}
        selectedTaskIds={selectedTaskIds}
        onSuccess={onRefetch}
        onClearSelection={() => {
          setSelectedTaskIds([]);
          setSelectionMode(false);
        }}
      />
    </>
  );
}
