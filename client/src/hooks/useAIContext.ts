/**
 * useAIContext - Hook for managing AI context with past decisions
 * 
 * Fetches and formats past decisions to inject into AI prompts
 */

import { trpc } from "@/lib/trpc";

interface UseAIContextOptions {
  projectId?: number;
  taskId?: string;
  enabled?: boolean;
}

export function useAIContext({ projectId, taskId, enabled = true }: UseAIContextOptions) {
  // Fetch formatted context for AI prompts
  const { data: contextString, isLoading } = trpc.aiDecision.getFormattedContext.useQuery(
    { projectId, taskId, limit: 5 },
    { 
      enabled: enabled && (!!projectId || !!taskId),
      staleTime: 60000, // Cache for 1 minute
      refetchOnWindowFocus: false,
    }
  );

  // Fetch raw decisions for display
  const { data: decisions } = trpc.aiDecision.getContextDecisions.useQuery(
    { projectId, taskId, limit: 10 },
    { 
      enabled: enabled && (!!projectId || !!taskId),
      staleTime: 60000,
      refetchOnWindowFocus: false,
    }
  );

  // Build enhanced prompt with context
  const buildPromptWithContext = (userMessage: string, systemPrompt?: string): string => {
    if (!contextString) {
      return userMessage;
    }

    // Inject context before the user's message
    return `${contextString}\n=== НОВЫЙ ВОПРОС ===\n\n${userMessage}`;
  };

  // Build system prompt with context awareness
  const buildSystemPromptWithContext = (baseSystemPrompt: string): string => {
    if (!contextString) {
      return baseSystemPrompt;
    }

    return `${baseSystemPrompt}

ВАЖНО: Учитывай прошлые решения пользователя при формировании ответа. 
Если новый вопрос связан с предыдущими решениями, ссылайся на них.
Не противоречь ранее принятым решениям без явного указания пользователя.`;
  };

  return {
    contextString,
    decisions,
    isLoading,
    hasContext: !!contextString,
    decisionCount: decisions?.length || 0,
    buildPromptWithContext,
    buildSystemPromptWithContext,
  };
}

export default useAIContext;
