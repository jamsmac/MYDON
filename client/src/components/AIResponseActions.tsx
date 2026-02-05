/**
 * AIResponseActions - Quick actions displayed under each AI response
 * 
 * Provides shortcuts for common actions after receiving an AI response
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  Copy, 
  FileText, 
  ListPlus, 
  MoreHorizontal,
  Sparkles,
  BookmarkPlus,
  Share2
} from "lucide-react";
import { FinalizeDecisionModal } from "./FinalizeDecisionModal";

interface AIResponseActionsProps {
  question: string;
  aiResponse: string;
  projectId?: number;
  taskId?: string;
  blockId?: string;
  sessionId?: number;
  onCreateSubtask?: (title: string) => void;
  onSaveToDocument?: () => void;
  compact?: boolean;
}

export function AIResponseActions({
  question,
  aiResponse,
  projectId,
  taskId,
  blockId,
  sessionId,
  onCreateSubtask,
  onSaveToDocument,
  compact = false,
}: AIResponseActionsProps) {
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiResponse);
      toast.success("Скопировано в буфер обмена");
    } catch (error) {
      toast.error("Не удалось скопировать");
    }
  };

  const handleCreateSubtask = () => {
    // Extract first sentence or line as potential subtask title
    const firstLine = aiResponse.split('\n')[0].replace(/^[#*-\s]+/, '').substring(0, 100);
    onCreateSubtask?.(firstLine);
  };

  const handleSaveToDocument = () => {
    onSaveToDocument?.();
    toast.info("Функция в разработке", {
      description: "Сохранение в документ скоро будет доступно",
    });
  };

  const handleFinalized = (decisionId: number) => {
    toast.success("Решение сохранено", {
      description: `ID: ${decisionId}`,
    });
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => setShowFinalizeModal(true)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Финализировать
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Копировать
              </DropdownMenuItem>
              {onCreateSubtask && (
                <DropdownMenuItem onClick={handleCreateSubtask}>
                  <ListPlus className="h-4 w-4 mr-2" />
                  Создать подзадачу
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSaveToDocument}>
                <FileText className="h-4 w-4 mr-2" />
                Сохранить в документ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <FinalizeDecisionModal
          open={showFinalizeModal}
          onOpenChange={setShowFinalizeModal}
          question={question}
          aiResponse={aiResponse}
          projectId={projectId}
          taskId={taskId}
          blockId={blockId}
          sessionId={sessionId}
          onFinalized={handleFinalized}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Действия:
        </span>
        
        {/* Main action - Finalize */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
          onClick={() => setShowFinalizeModal(true)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Финализировать итоги
        </Button>

        {/* Copy */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleCopy}
        >
          <Copy className="h-3.5 w-3.5" />
          Копировать
        </Button>

        {/* Create subtask (if task context) */}
        {onCreateSubtask && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleCreateSubtask}
          >
            <ListPlus className="h-3.5 w-3.5" />
            Создать подзадачу
          </Button>
        )}

        {/* Save to document */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSaveToDocument}
        >
          <FileText className="h-3.5 w-3.5" />
          В документ
        </Button>

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <MoreHorizontal className="h-3.5 w-3.5" />
              Ещё
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Добавить в избранное
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2 className="h-4 w-4 mr-2" />
              Поделиться
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              Улучшить ответ (скоро)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FinalizeDecisionModal
        open={showFinalizeModal}
        onOpenChange={setShowFinalizeModal}
        question={question}
        aiResponse={aiResponse}
        projectId={projectId}
        taskId={taskId}
        blockId={blockId}
        sessionId={sessionId}
        onFinalized={handleFinalized}
      />
    </>
  );
}

export default AIResponseActions;
