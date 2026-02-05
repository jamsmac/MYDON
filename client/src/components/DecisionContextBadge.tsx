/**
 * DecisionContextBadge - Shows AI context status indicator
 * 
 * Displays how many past decisions are loaded in the AI context
 */

import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Brain, Loader2 } from "lucide-react";

interface DecisionContextBadgeProps {
  decisionCount: number;
  isLoading?: boolean;
  onClick?: () => void;
}

export function DecisionContextBadge({ 
  decisionCount, 
  isLoading,
  onClick 
}: DecisionContextBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Загрузка контекста...
      </Badge>
    );
  }

  if (decisionCount === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="secondary" 
          className="gap-1 text-xs cursor-pointer hover:bg-secondary/80"
          onClick={onClick}
        >
          <Brain className="h-3 w-3 text-purple-500" />
          {decisionCount} {decisionCount === 1 ? 'решение' : 
            decisionCount < 5 ? 'решения' : 'решений'} в контексте
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>AI учитывает {decisionCount} прошлых решений</p>
        <p className="text-xs text-muted-foreground">Нажмите для просмотра</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default DecisionContextBadge;
