import { QuickCommands } from "./QuickCommands";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { AIChatHistory } from "./AIChatHistory";
import { cn } from "@/lib/utils";

interface AIToolbarProps {
  projectId: number;
  projectName: string;
  blockId?: number;
  sectionId?: number;
  taskId?: number;
  className?: string;
  showExecutiveSummary?: boolean;
  showHistory?: boolean;
}

export function AIToolbar({
  projectId,
  projectName,
  blockId,
  sectionId,
  taskId,
  className,
  showExecutiveSummary = true,
  showHistory = true,
}: AIToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <QuickCommands
        projectId={projectId}
        blockId={blockId}
        sectionId={sectionId}
        taskId={taskId}
      />
      
      {showExecutiveSummary && (
        <ExecutiveSummary
          projectId={projectId}
          projectName={projectName}
        />
      )}
      
      {showHistory && (
        <AIChatHistory
          projectId={projectId}
          blockId={blockId}
          sectionId={sectionId}
          taskId={taskId}
        />
      )}
    </div>
  );
}

export { SmartSuggestions } from "./SmartSuggestions";
export { PriorityDetector } from "./PriorityDetector";
export { RiskDetectionPanel } from "./RiskDetectionPanel";
export { ExecutiveSummary } from "./ExecutiveSummary";
export { QuickCommands } from "./QuickCommands";
export { AIChatHistory } from "./AIChatHistory";
