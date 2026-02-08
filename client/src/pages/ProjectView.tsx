import { useAuth } from '@/_core/hooks/useAuth';
import { EntityAIChatStoreProvider } from '@/contexts/EntityAIChatStore';
import { useSocket } from '@/hooks/useSocket';
import { trpc } from '@/lib/trpc';
import { useParams, useLocation } from 'wouter';
import { PullToRefresh } from '@/components/PullToRefresh';
import { SwipeIndicator } from '@/components/SwipeIndicator';
import { useState, useMemo, useCallback } from 'react';
import { useMobile } from '@/hooks/useMobile';
import { useToggleState } from '@/hooks/useToggleState';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useAIChatContext } from '@/contexts/AIChatContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSidebarHandlers } from '@/hooks/useSidebarHandlers';
import { useDetailPanelHandlers } from '@/hooks/useDetailPanelHandlers';
import { useProjectMutations } from '@/hooks/useProjectMutations';
import { useProjectContextSync } from '@/hooks/useProjectContextSync';
import { useContextContent } from '@/hooks/useContextContent';
import { useProjectSwipeNavigation } from '@/hooks/useProjectSwipeNavigation';
import { useTaskSaveHandlers } from '@/hooks/useTaskSaveHandlers';
import { ProjectMobileHeader } from '@/components/ProjectMobileHeader';
import { FloatingAIButton } from '@/components/AIAssistantButton';
import { ProjectDialogs } from '@/components/ProjectDialogs';
import { MainContentArea } from '@/components/MainContentArea';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import { MobileSidebar } from '@/components/MobileSidebar';
import { LoadingSpinner, ProjectNotFound, redirectToLogin } from '@/components/ProjectLoadingStates';

// Types
interface ProjectBlock { id: number; title: string; titleRu?: string | null; sections?: ProjectSection[]; number?: number | null; }
interface ProjectSection { id: number; title: string; tasks?: ProjectTask[]; sortOrder?: number | null; }
interface ProjectTask { id: number; title: string; status: string | null; priority?: string | null; deadline?: Date | string | null; createdAt?: Date | string | null; description?: string | null; notes?: string | null; sortOrder?: number | null; }
interface SelectedContext { type: 'project' | 'block' | 'section' | 'task'; id: number; title: string; content?: string; }
interface SelectedTask { id: number; title: string; description?: string | null; status: string | null; notes?: string | null; summary?: string | null; sectionId: number; sortOrder?: number | null; }

export default function ProjectView() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || '0');
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isMobile } = useMobile();
  const { setTask: setAIChatTask } = useAIChatContext();

  // UI state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [selectedContext, setSelectedContext] = useState<SelectedContext | null>(null);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [filteredTaskIds, setFilteredTaskIds] = useState<Set<number>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [discussionEntity, setDiscussionEntity] = useState<{ type: 'project' | 'block' | 'section' | 'task'; id: number; title: string } | null>(null);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<{ id: number; title: string; sectionId: number; status: string } | null>(null);
  const [selectedSectionForAction, setSelectedSectionForAction] = useState<{ id: number; title: string; blockId: number; tasks: any[] } | null>(null);

  // Toggle & dialog states
  const blocksToggle = useToggleState();
  const sectionsToggle = useToggleState();
  const { create: createDialogs, taskAction: taskActionDialogs, feature: featureDialogs } = useDialogStates();

  // Data fetching
  const { data: project, isLoading, refetch } = trpc.project.getFull.useQuery({ id: projectId }, { enabled: isAuthenticated && projectId > 0 });
  const { data: unreadCounts, refetch: refetchUnread } = trpc.collaboration.getUnreadCounts.useQuery({ projectId }, { enabled: isAuthenticated && projectId > 0, refetchInterval: 30000 });

  // Context hooks
  useProjectContextSync(project);
  const getContextContent = useContextContent(project);
  const progress = useProjectProgress(project?.blocks);

  // Socket
  const { presenceUsers, emitTaskUpdated, emitTaskCreated, emitTaskDeleted, startTypingComment, stopTypingComment, getTypingUsersForTask } = useSocket({
    projectId: isAuthenticated ? projectId : undefined,
    onTaskChange: (event) => {
      if (event.type === 'created') toast.info(`${event.createdBy} создал новую задачу`);
      else if (event.type === 'updated') toast.info(`${event.updatedBy} обновил задачу`);
      else if (event.type === 'deleted') toast.info(`${event.deletedBy} удалил задачу`);
      refetch();
    },
    onTaskEditingConflict: (info) => toast.warning(`${info.editingBy} уже редактирует эту задачу`),
  });

  // Mutations
  const mutations = useProjectMutations({
    projectId, onRefetch: refetch, onTaskCreated: emitTaskCreated, onTaskUpdated: emitTaskUpdated,
    onTaskDeleted: (taskId) => selectedTask && emitTaskDeleted(taskId, selectedTask.sectionId),
    onBlockCreated: () => createDialogs.setBlockOpen(false), onSectionCreated: () => createDialogs.setSectionOpen(false),
    onTaskCreatedSuccess: () => createDialogs.setTaskOpen(false), onProjectDeleted: () => navigate('/'),
  });
  const markReadMutation = trpc.collaboration.markDiscussionRead.useMutation({ onSuccess: () => refetchUnread() });

  // All tasks
  const allTasks = useMemo(() => {
    if (!project?.blocks) return [];
    return project.blocks.flatMap((b: ProjectBlock) => b.sections?.flatMap((s: ProjectSection) => s.tasks?.map((t: ProjectTask) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority as any, deadline: t.deadline, createdAt: t.createdAt })) || []) || []);
  }, [project]);

  // Navigation hooks
  const { selectTask: mobileSelectTask, selectContext: mobileSelectContext, backToList: mobileBackToList } = useMobileNavigation({ isMobile, setSelectedTask, setSelectedContext, setMobileShowDetail, setMobileSidebarOpen });

  const { swipeNavigationItems, swipeCurrentIndex, swipeHandlers, swipeOffset, isAnimating, canGoNext, canGoPrev } = useProjectSwipeNavigation({
    project, selectedContext, isMobile, mobileShowDetail, selectedTask, getContextContent,
    setSelectedContext, setSelectedTask: () => setSelectedTask(null), setAIChatTask: () => setAIChatTask(null), setMobileShowDetail,
  });

  // Sidebar & detail handlers
  const sidebarHandlers = useSidebarHandlers({
    projectId, getContextContent, setSelectedContext, setSelectedTask, setAIChatTask, setDiscussionEntity,
    createDialogs: { openSection: createDialogs.openSection, openTask: createDialogs.openTask },
    mutations: { deleteBlock: mutations.deleteBlock, deleteSection: mutations.deleteSection, deleteTask: mutations.deleteTask, moveTask: mutations.moveTask, moveSection: mutations.moveSection, reorderTasks: mutations.reorderTasks, reorderSections: mutations.reorderSections, reorderBlocks: mutations.reorderBlocks, updateTask: mutations.updateTask, updateSection: mutations.updateSection, updateBlock: mutations.updateBlock },
  });

  const detailPanelHandlers = useDetailPanelHandlers({
    project: project || { blocks: [] }, getContextContent, setSelectedContext, setSelectedTask, setSelectedTaskForAction, setSelectedSectionForAction,
    createDialogs: { openSection: createDialogs.openSection, openTask: createDialogs.openTask },
    taskActionDialogs: { setSplitOpen: taskActionDialogs.setSplitOpen, setMergeOpen: taskActionDialogs.setMergeOpen, setConvertToSectionOpen: taskActionDialogs.setConvertToSectionOpen, setConvertToTaskOpen: taskActionDialogs.setConvertToTaskOpen },
    mutations: { deleteTask: mutations.deleteTask, duplicateTask: mutations.duplicateTask, updateTask: mutations.updateTask, markRead: markReadMutation },
  });

  // Task save handlers
  const { handleSaveAsNote, handleSaveAsDocument } = useTaskSaveHandlers({ selectedTask, setSelectedTask, updateTaskMutate: mutations.updateTask.mutate });

  const handlePullRefresh = useCallback(async () => { await Promise.all([refetch(), refetchUnread()]); }, [refetch, refetchUnread]);
  const handleSelectProjectChat = useCallback(() => { if (!project) return; setSelectedTask(null); setSelectedContext({ type: 'project', id: project.id, title: project.name, content: getContextContent('project', project.id) }); }, [project, getContextContent]);

  // Loading states
  if (authLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return redirectToLogin();
  if (isLoading) return <LoadingSpinner />;
  if (!project) return <ProjectNotFound />;

  return (
    <EntityAIChatStoreProvider>
      <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row">
        {isMobile && <ProjectMobileHeader projectName={project.name} mobileShowDetail={mobileShowDetail} selectedTaskTitle={selectedTask?.title} selectedContextTitle={selectedContext?.title} progressCompleted={progress.completed} progressTotal={progress.total} onBackToList={mobileBackToList} onOpenSidebar={() => setMobileSidebarOpen(true)} />}

        {isMobile && <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} project={project} projectId={projectId} progress={progress} expandedBlocks={blocksToggle.expanded} expandedSections={sectionsToggle.expanded} selectedContext={selectedContext} selectedTask={selectedTask} filteredTaskIds={filteredTaskIds} unreadCounts={unreadCounts} allTasks={allTasks} sidebarHandlers={sidebarHandlers} onToggleBlock={blocksToggle.toggle} onToggleSection={sectionsToggle.toggle} onFilteredTasksChange={setFilteredTaskIds} getContextContent={getContextContent} onSelectContext={(ctx) => { mobileSelectContext(ctx); if (ctx.type !== 'task') { setSelectedTask(null); setAIChatTask(null); } }} onSelectTask={(task) => { mobileSelectTask(task); sidebarHandlers.onSelectTask(task); }} onSelectProjectChat={handleSelectProjectChat} />}

        {!isMobile && <DesktopSidebar project={project} projectId={projectId} progress={progress} expandedBlocks={blocksToggle.expanded} expandedSections={sectionsToggle.expanded} selectedContext={selectedContext} selectedTask={selectedTask} filteredTaskIds={filteredTaskIds} unreadCounts={unreadCounts} allTasks={allTasks} presenceUsers={presenceUsers} sidebarHandlers={sidebarHandlers} onToggleBlock={blocksToggle.toggle} onToggleSection={sectionsToggle.toggle} onFilteredTasksChange={setFilteredTaskIds} getContextContent={getContextContent} onSelectProjectChat={handleSelectProjectChat} onNavigate={navigate} onSaveToDrive={() => mutations.saveToDrive.mutate({ projectId })} onExportToGoogleDocs={() => mutations.exportToGoogleDocs.mutate({ projectId })} onOpenCalendar={() => featureDialogs.setCalendarOpen(true)} onOpenCustomFields={() => featureDialogs.setCustomFieldsOpen(true)} onOpenAIAssistant={() => featureDialogs.setAIAssistantOpen(true)} onOpenRiskPanel={() => featureDialogs.setRiskPanelOpen(true)} onOpenSaveTemplate={() => featureDialogs.setSaveTemplateOpen(true)} onOpenPitchDeck={() => featureDialogs.setPitchDeckOpen(true)} onDeleteProject={mutations.handleDeleteProject} onSaveToNotebookLM={mutations.handleSaveToNotebookLM} isSavingToDrive={mutations.saveToDrive.isPending} isExportingToGoogleDocs={mutations.exportToGoogleDocs.isPending} createBlockOpen={createDialogs.blockOpen} setCreateBlockOpen={createDialogs.setBlockOpen} newBlockTitle={createDialogs.blockTitle} newBlockTitleRu={createDialogs.blockTitleRu} setNewBlockTitle={createDialogs.setBlockTitle} setNewBlockTitleRu={createDialogs.setBlockTitleRu} onCreateBlock={() => mutations.createBlock.mutate({ projectId, number: (project.blocks?.length || 0) + 1, title: createDialogs.blockTitle.trim(), titleRu: createDialogs.blockTitleRu.trim() || undefined })} isCreatingBlock={mutations.createBlock.isPending} />}

        <PullToRefresh onRefresh={handlePullRefresh} className={cn("flex-1 flex flex-col min-w-0", isMobile && "pt-12")}>
          <main id="main-content" tabIndex={-1} className="flex-1 flex min-w-0 outline-none">
            <div className={cn("flex-1 flex flex-col min-w-0", isMobile && mobileShowDetail && "fixed inset-0 z-40 bg-slate-900 pt-12")} {...(isMobile && mobileShowDetail && !selectedTask ? swipeHandlers : {})}>
              {isMobile && mobileShowDetail && !selectedTask && selectedContext && swipeNavigationItems.length > 1 && <SwipeIndicator currentIndex={swipeCurrentIndex} totalItems={swipeNavigationItems.length} canGoLeft={canGoNext} canGoRight={canGoPrev} labels={swipeNavigationItems.map((i: { title: string }) => i.title)} className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 py-2" />}
              <div style={{ transform: isMobile && mobileShowDetail && !selectedTask ? `translateX(${swipeOffset}px)` : undefined, transition: isAnimating ? 'transform 0.2s ease-out' : undefined }} className="flex-1 flex flex-col min-w-0">
                <MainContentArea project={project} projectId={projectId} isMobile={isMobile} selectedTask={selectedTask} selectedContext={selectedContext} allTasks={allTasks} discussionEntity={discussionEntity} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} progress={progress} handlers={detailPanelHandlers} onCloseTask={() => { setSelectedTask(null); setAIChatTask(null); }} onUpdateTask={(data) => { mutations.updateTask.mutate({ id: selectedTask!.id, ...data }); setSelectedTask({ ...selectedTask!, ...data } as any); }} onSaveNote={handleSaveAsNote} onSaveDocument={handleSaveAsDocument} onTypingStart={() => selectedTask && startTypingComment(selectedTask.id)} onTypingStop={() => selectedTask && stopTypingComment(selectedTask.id)} typingUsers={selectedTask ? getTypingUsersForTask(selectedTask.id, user?.id).map(u => ({ userId: u.userId, userName: u.userName })) : []} setDiscussionEntity={setDiscussionEntity} onToggleSelectionMode={() => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedTaskIds([]); }} onToggleTaskSelection={(taskId) => setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId])} onBulkActions={() => taskActionDialogs.setBulkActionsOpen(true)} getContextContent={getContextContent} setSelectedContext={setSelectedContext} setSelectedTask={setSelectedTask} setMobileShowDetail={setMobileShowDetail} />
              </div>
            </div>
          </main>
        </PullToRefresh>

        <FloatingAIButton />
        <ProjectDialogs project={project} projectId={projectId} createDialogs={{ sectionOpen: createDialogs.sectionOpen, setSectionOpen: createDialogs.setSectionOpen, sectionTitle: createDialogs.sectionTitle, setSectionTitle: createDialogs.setSectionTitle, targetBlockId: createDialogs.targetBlockId, taskOpen: createDialogs.taskOpen, setTaskOpen: createDialogs.setTaskOpen, targetSectionId: createDialogs.targetSectionId }} featureDialogs={{ calendarOpen: featureDialogs.calendarOpen, setCalendarOpen: featureDialogs.setCalendarOpen, saveTemplateOpen: featureDialogs.saveTemplateOpen, setSaveTemplateOpen: featureDialogs.setSaveTemplateOpen, pitchDeckOpen: featureDialogs.pitchDeckOpen, setPitchDeckOpen: featureDialogs.setPitchDeckOpen, aiAssistantOpen: featureDialogs.aiAssistantOpen, setAIAssistantOpen: featureDialogs.setAIAssistantOpen, riskPanelOpen: featureDialogs.riskPanelOpen, setRiskPanelOpen: featureDialogs.setRiskPanelOpen, customFieldsOpen: featureDialogs.customFieldsOpen, setCustomFieldsOpen: featureDialogs.setCustomFieldsOpen }} taskActionDialogs={{ splitOpen: taskActionDialogs.splitOpen, setSplitOpen: taskActionDialogs.setSplitOpen, mergeOpen: taskActionDialogs.mergeOpen, setMergeOpen: taskActionDialogs.setMergeOpen, convertToSectionOpen: taskActionDialogs.convertToSectionOpen, setConvertToSectionOpen: taskActionDialogs.setConvertToSectionOpen, convertToTaskOpen: taskActionDialogs.convertToTaskOpen, setConvertToTaskOpen: taskActionDialogs.setConvertToTaskOpen, bulkActionsOpen: taskActionDialogs.bulkActionsOpen, setBulkActionsOpen: taskActionDialogs.setBulkActionsOpen }} selectedTaskForAction={selectedTaskForAction} selectedSectionForAction={selectedSectionForAction} selectedTaskIds={selectedTaskIds} selectionMode={selectionMode} setSelectedTaskIds={setSelectedTaskIds} setSelectionMode={setSelectionMode} getContextContent={getContextContent} onCreateSection={(blockId, title) => mutations.createSection.mutate({ blockId, title })} onCreateTask={(sectionId, task) => mutations.createTask.mutate({ sectionId, title: task.title, description: task.description, priority: task.priority as any, deadline: task.dueDate })} isCreateSectionPending={mutations.createSection.isPending} isCreateTaskPending={mutations.createTask.isPending} onRefetch={refetch} />
      </div>
    </EntityAIChatStoreProvider>
  );
}
