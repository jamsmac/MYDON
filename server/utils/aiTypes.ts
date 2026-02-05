/**
 * AI Router Types and Interfaces
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'builtin';

export type TaskType = 
  | 'reasoning'    // Complex analysis, planning
  | 'coding'       // Code generation, debugging
  | 'vision'       // Image analysis
  | 'chat'         // General conversation
  | 'translation'  // Language translation
  | 'summarization' // Text summarization
  | 'creative';    // Creative writing

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  messages: AIMessage[];
  taskType?: TaskType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  userId?: number;
  useCache?: boolean;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  fromCache: boolean;
  executionTime: number;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  models: string[];
  defaultModel: string;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

export interface AIRouterConfig {
  providers: Record<AIProvider, ProviderConfig>;
  taskModelMapping: Record<TaskType, { provider: AIProvider; model: string }>;
  fallbackOrder: AIProvider[];
  cacheEnabled: boolean;
  loggingEnabled: boolean;
}

// Default model mapping based on task type
export const DEFAULT_TASK_MODEL_MAPPING: Record<TaskType, { provider: AIProvider; model: string }> = {
  reasoning: { provider: 'builtin', model: 'default' },
  coding: { provider: 'builtin', model: 'default' },
  vision: { provider: 'builtin', model: 'default' },
  chat: { provider: 'builtin', model: 'default' },
  translation: { provider: 'builtin', model: 'default' },
  summarization: { provider: 'builtin', model: 'default' },
  creative: { provider: 'builtin', model: 'default' },
};

// Cost per 1k tokens (approximate)
export const PROVIDER_COSTS: Record<AIProvider, { input: number; output: number }> = {
  openai: { input: 0.01, output: 0.03 },      // GPT-4 Turbo
  anthropic: { input: 0.008, output: 0.024 }, // Claude 3 Sonnet
  google: { input: 0.00025, output: 0.0005 }, // Gemini Pro
  builtin: { input: 0, output: 0 },           // Built-in (free)
};
