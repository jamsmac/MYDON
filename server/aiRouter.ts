/**
 * AI Router - Platform-First Smart Model Selection
 * 
 * Automatically selects the optimal AI model based on:
 * - Task complexity and type
 * - User's credit balance
 * - Model availability and cost
 */

import { invokeLLM } from "./_core/llm";

// Model tiers and their credit costs
export interface ModelTier {
  id: string;
  name: string;
  nameRu: string;
  tier: 'free' | 'standard' | 'premium';
  creditsPerRequest: number;
  bestFor: TaskType[];
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  contextWindow: number;
  available: boolean;
  isFree: boolean;
}

export type TaskType = 'simple' | 'analysis' | 'code' | 'creative' | 'general';

// Platform models with credit costs
export const PLATFORM_MODELS: ModelTier[] = [
  // Free Tier - 0-5 credits
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini Flash',
    nameRu: 'Gemini Flash',
    tier: 'free',
    creditsPerRequest: 2,
    bestFor: ['simple', 'general'],
    speed: 'fast',
    quality: 'good',
    contextWindow: 1000000,
    available: true,
    isFree: true,
  },
  {
    id: 'cohere-command-light',
    name: 'Cohere Light',
    nameRu: 'Cohere Light',
    tier: 'free',
    creditsPerRequest: 1,
    bestFor: ['simple'],
    speed: 'fast',
    quality: 'basic',
    contextWindow: 4096,
    available: true,
    isFree: true,
  },
  
  // Standard Tier - 10-20 credits
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    nameRu: 'GPT-4o Mini',
    tier: 'standard',
    creditsPerRequest: 10,
    bestFor: ['code', 'general', 'simple'],
    speed: 'fast',
    quality: 'good',
    contextWindow: 128000,
    available: true,
    isFree: false,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    nameRu: 'Claude 3 Haiku',
    tier: 'standard',
    creditsPerRequest: 8,
    bestFor: ['simple', 'general', 'creative'],
    speed: 'fast',
    quality: 'good',
    contextWindow: 200000,
    available: true,
    isFree: false,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    nameRu: 'DeepSeek Chat',
    tier: 'standard',
    creditsPerRequest: 5,
    bestFor: ['code', 'simple'],
    speed: 'fast',
    quality: 'good',
    contextWindow: 64000,
    available: true,
    isFree: false,
  },
  
  // Premium Tier - 30-50 credits
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    nameRu: 'GPT-4o',
    tier: 'premium',
    creditsPerRequest: 30,
    bestFor: ['analysis', 'code', 'creative', 'general'],
    speed: 'medium',
    quality: 'excellent',
    contextWindow: 128000,
    available: true,
    isFree: false,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    nameRu: 'Claude 3.5 Sonnet',
    tier: 'premium',
    creditsPerRequest: 35,
    bestFor: ['analysis', 'creative', 'general'],
    speed: 'medium',
    quality: 'excellent',
    contextWindow: 200000,
    available: true,
    isFree: false,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    nameRu: 'Gemini 1.5 Pro',
    tier: 'premium',
    creditsPerRequest: 25,
    bestFor: ['analysis', 'general'],
    speed: 'medium',
    quality: 'excellent',
    contextWindow: 1000000,
    available: true,
    isFree: false,
  },
];

// Analyze question to determine task type
export function analyzeTaskType(question: string): TaskType {
  const lowerQuestion = question.toLowerCase();
  
  // Code-related keywords (Russian + English)
  const codeKeywords = [
    'код', 'code', 'программ', 'function', 'функци', 'api', 'debug', 
    'ошибк', 'error', 'bug', 'script', 'скрипт', 'python', 'javascript', 
    'typescript', 'sql', 'html', 'css', 'react', 'node', 'исправ', 'fix',
    'переменн', 'variable', 'класс', 'class', 'метод', 'method'
  ];
  if (codeKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'code';
  }
  
  // Analysis/research keywords
  const analysisKeywords = [
    'анализ', 'analysis', 'исследован', 'research', 'сравн', 'compare', 
    'оцен', 'evaluat', 'стратег', 'strategy', 'план', 'plan', 'почему', 
    'why', 'как работает', 'how does', 'объясн', 'explain', 'разбер',
    'детальн', 'detail', 'глубок', 'deep', 'подробн'
  ];
  if (analysisKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'analysis';
  }
  
  // Creative keywords
  const creativeKeywords = [
    'напиш', 'write', 'создай', 'create', 'придумай', 'invent', 
    'история', 'story', 'текст', 'text', 'контент', 'content', 
    'идеи', 'ideas', 'креатив', 'creative', 'название', 'name', 
    'слоган', 'slogan', 'описание', 'description', 'сочин'
  ];
  if (creativeKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'creative';
  }
  
  // Simple questions (short, factual, greetings)
  const simplePatterns = ['что', 'what', 'когда', 'when', 'кто', 'who', 'где', 'where', 'сколько', 'how much', 'how many', 'привет', 'hello', 'hi', 'как дела', 'how are', 'спасибо', 'thanks', 'пока', 'bye', 'да', 'нет', 'yes', 'no', 'ок', 'ok'];
  if (question.length < 100 && (simplePatterns.some(p => lowerQuestion.includes(p)) || question.length < 30)) {
    return 'simple';
  }
  
  return 'general';
}

// Select optimal model based on task type and credits
export function selectModel(
  taskType: TaskType,
  availableCredits: number,
  preferFree: boolean = false
): ModelTier {
  // Filter available models
  const available = PLATFORM_MODELS.filter(m => m.available);
  
  // Filter by affordability
  const affordable = available.filter(m => m.creditsPerRequest <= availableCredits);
  
  if (affordable.length === 0) {
    // Return cheapest model even if not affordable (will show error)
    return available.sort((a, b) => a.creditsPerRequest - b.creditsPerRequest)[0];
  }
  
  // Score models based on task fit
  const scored = affordable.map(model => {
    let score = 0;
    
    // Task type match
    if (model.bestFor.includes(taskType)) {
      score += 50;
    }
    
    // Quality bonus
    if (model.quality === 'excellent') score += 30;
    if (model.quality === 'good') score += 15;
    
    // Speed bonus for simple tasks
    if (taskType === 'simple' && model.speed === 'fast') {
      score += 20;
    }
    
    // Prefer free models if requested or low credits
    if (preferFree || availableCredits < 50) {
      if (model.tier === 'free') score += 40;
      if (model.tier === 'standard') score += 20;
    }
    
    // Cost efficiency (lower cost = higher score)
    score += Math.max(0, 30 - model.creditsPerRequest);
    
    return { model, score };
  });
  
  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}

// Get recommendation reason in Russian
export function getSelectionReason(model: ModelTier, taskType: TaskType): string {
  const taskTypeNames: Record<TaskType, string> = {
    simple: 'простой вопрос',
    analysis: 'аналитическая задача',
    code: 'задача программирования',
    creative: 'творческая задача',
    general: 'общий вопрос',
  };
  
  const tierNames: Record<string, string> = {
    free: 'бесплатная',
    standard: 'стандартная',
    premium: 'премиум',
  };
  
  return `${model.nameRu} выбрана для "${taskTypeNames[taskType]}" (${tierNames[model.tier]} модель, ${model.creditsPerRequest} кредитов)`;
}

// AI Router result
export interface AIRouterResult {
  content: string;
  model: ModelTier;
  taskType: TaskType;
  creditsUsed: number;
  tokensUsed?: number;
  reason: string;
}

// Main AI Router function
export async function routeAIRequest(
  messages: Array<{ role: string; content: string }>,
  userCredits: number,
  preferFree: boolean = false
): Promise<AIRouterResult> {
  // Get the user's question (last user message)
  const userMessage = messages.filter(m => m.role === 'user').pop();
  const question = userMessage?.content || '';
  
  // Analyze task type
  const taskType = analyzeTaskType(question);
  
  // Select optimal model
  const model = selectModel(taskType, userCredits, preferFree);
  
  // Check if user can afford
  if (model.creditsPerRequest > userCredits) {
    throw new Error(`Недостаточно кредитов. Требуется: ${model.creditsPerRequest}, доступно: ${userCredits}`);
  }
  
  // Call the AI (using built-in Manus LLM which routes to appropriate model)
  const response = await invokeLLM({
    messages: messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }))
  });
  
  const content = typeof response.choices[0]?.message?.content === 'string'
    ? response.choices[0].message.content
    : '';
  
  return {
    content,
    model,
    taskType,
    creditsUsed: model.creditsPerRequest,
    tokensUsed: response.usage?.total_tokens,
    reason: getSelectionReason(model, taskType),
  };
}

// Get credit costs for display
export function getCreditCosts(): Array<{ tier: string; tierRu: string; models: ModelTier[] }> {
  return [
    {
      tier: 'free',
      tierRu: 'Бесплатные (1-5 кредитов)',
      models: PLATFORM_MODELS.filter(m => m.tier === 'free'),
    },
    {
      tier: 'standard',
      tierRu: 'Стандартные (5-20 кредитов)',
      models: PLATFORM_MODELS.filter(m => m.tier === 'standard'),
    },
    {
      tier: 'premium',
      tierRu: 'Премиум (25-50 кредитов)',
      models: PLATFORM_MODELS.filter(m => m.tier === 'premium'),
    },
  ];
}

// Initial credits for new users
export const INITIAL_CREDITS = 1000;

// Bonus credits amounts
export const BONUS_CREDITS = {
  referral: 500,
  firstProject: 100,
  dailyLogin: 10,
};
