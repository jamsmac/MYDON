/**
 * AI Providers Module
 * Supports multiple AI providers including free tiers
 */

import { invokeLLM } from "./_core/llm";

// Provider configuration types
export interface ProviderConfig {
  id: string;
  name: string;
  nameRu: string;
  isFree: boolean;
  costPer1kTokens: number; // in USD, 0 for free
  models: ModelConfig[];
  category: 'premium' | 'free' | 'local';
  requiresApiKey: boolean;
  baseUrl?: string;
  description: string;
  descriptionRu: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  bestFor: TaskType[];
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
}

export type TaskType = 'simple' | 'analysis' | 'code' | 'creative' | 'general';

// All supported providers
export const AI_PROVIDERS: ProviderConfig[] = [
  // Premium Providers
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    nameRu: 'Anthropic Claude',
    isFree: false,
    costPer1kTokens: 0.008,
    category: 'premium',
    requiresApiKey: true,
    description: 'Best for analysis, research, and complex reasoning',
    descriptionRu: 'Лучший для анализа, исследований и сложных рассуждений',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, bestFor: ['analysis', 'creative', 'general'], speed: 'medium', quality: 'excellent' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    nameRu: 'OpenAI GPT',
    isFree: false,
    costPer1kTokens: 0.01,
    category: 'premium',
    requiresApiKey: true,
    description: 'Versatile AI for all tasks, excellent for code',
    descriptionRu: 'Универсальный AI для всех задач, отлично для кода',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, bestFor: ['code', 'analysis', 'general'], speed: 'medium', quality: 'excellent' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, bestFor: ['simple', 'code'], speed: 'fast', quality: 'good' },
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini Pro',
    nameRu: 'Google Gemini Pro',
    isFree: false,
    costPer1kTokens: 0.00125,
    category: 'premium',
    requiresApiKey: true,
    description: 'Google\'s flagship model with multimodal capabilities',
    descriptionRu: 'Флагманская модель Google с мультимодальными возможностями',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, bestFor: ['analysis', 'general'], speed: 'medium', quality: 'excellent' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
    ]
  },
  
  // Free Providers
  {
    id: 'gemini_free',
    name: 'Gemini Free',
    nameRu: 'Gemini Бесплатный',
    isFree: true,
    costPer1kTokens: 0,
    category: 'free',
    requiresApiKey: true,
    description: 'Free tier of Google Gemini (15 RPM, 1M tokens/day)',
    descriptionRu: 'Бесплатный уровень Google Gemini (15 запросов/мин, 1M токенов/день)',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    nameRu: 'DeepSeek',
    isFree: false,
    costPer1kTokens: 0.00014, // Very cheap
    category: 'free',
    requiresApiKey: true,
    baseUrl: 'https://api.deepseek.com',
    description: 'Very affordable Chinese AI, excellent for code',
    descriptionRu: 'Очень доступный китайский AI, отлично для кода',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, bestFor: ['code', 'simple', 'general'], speed: 'fast', quality: 'good' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 64000, bestFor: ['code'], speed: 'fast', quality: 'excellent' },
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    nameRu: 'Hugging Face',
    isFree: true,
    costPer1kTokens: 0,
    category: 'free',
    requiresApiKey: true,
    baseUrl: 'https://api-inference.huggingface.co',
    description: 'Free inference API with various open models',
    descriptionRu: 'Бесплатный API с различными открытыми моделями',
    models: [
      { id: 'mistralai/Mistral-7B-Instruct-v0.2', name: 'Mistral 7B', contextWindow: 32000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'basic' },
      { id: 'meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70B', contextWindow: 4096, bestFor: ['general'], speed: 'medium', quality: 'good' },
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    nameRu: 'Ollama (Локальный)',
    isFree: true,
    costPer1kTokens: 0,
    category: 'local',
    requiresApiKey: false,
    baseUrl: 'http://localhost:11434',
    description: 'Run AI models locally on your machine',
    descriptionRu: 'Запуск AI моделей локально на вашем компьютере',
    models: [
      { id: 'llama3', name: 'Llama 3', contextWindow: 8192, bestFor: ['simple', 'general'], speed: 'medium', quality: 'good' },
      { id: 'mistral', name: 'Mistral', contextWindow: 32000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
      { id: 'codellama', name: 'Code Llama', contextWindow: 16000, bestFor: ['code'], speed: 'medium', quality: 'good' },
      { id: 'phi3', name: 'Phi-3', contextWindow: 4096, bestFor: ['simple'], speed: 'fast', quality: 'basic' },
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    nameRu: 'Groq',
    isFree: false,
    costPer1kTokens: 0.0001,
    category: 'free', // Very cheap, almost free
    requiresApiKey: true,
    description: 'Ultra-fast inference, great for quick tasks',
    descriptionRu: 'Сверхбыстрый вывод, отлично для быстрых задач',
    models: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', contextWindow: 128000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, bestFor: ['simple', 'code'], speed: 'fast', quality: 'good' },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    nameRu: 'Mistral AI',
    isFree: false,
    costPer1kTokens: 0.002,
    category: 'premium',
    requiresApiKey: true,
    description: 'European AI with strong multilingual support',
    descriptionRu: 'Европейский AI с сильной мультиязычной поддержкой',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, bestFor: ['analysis', 'general'], speed: 'medium', quality: 'excellent' },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000, bestFor: ['simple', 'general'], speed: 'fast', quality: 'good' },
    ]
  },
];

// Get provider by ID
export function getProvider(providerId: string): ProviderConfig | undefined {
  return AI_PROVIDERS.find(p => p.id === providerId);
}

// Get all free providers
export function getFreeProviders(): ProviderConfig[] {
  return AI_PROVIDERS.filter(p => p.isFree || p.category === 'free');
}

// Get all premium providers
export function getPremiumProviders(): ProviderConfig[] {
  return AI_PROVIDERS.filter(p => p.category === 'premium');
}

// Analyze question type
export function analyzeQuestionType(question: string): TaskType {
  const lowerQuestion = question.toLowerCase();
  
  // Code-related keywords
  const codeKeywords = ['код', 'code', 'программ', 'function', 'функци', 'api', 'debug', 'ошибк', 'error', 'bug', 'script', 'скрипт', 'python', 'javascript', 'typescript', 'sql', 'html', 'css', 'react', 'node'];
  if (codeKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'code';
  }
  
  // Analysis/research keywords
  const analysisKeywords = ['анализ', 'analysis', 'исследован', 'research', 'сравн', 'compare', 'оцен', 'evaluat', 'стратег', 'strategy', 'план', 'plan', 'почему', 'why', 'как работает', 'how does', 'объясн', 'explain'];
  if (analysisKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'analysis';
  }
  
  // Creative keywords
  const creativeKeywords = ['напиш', 'write', 'создай', 'create', 'придумай', 'invent', 'история', 'story', 'текст', 'text', 'контент', 'content', 'идеи', 'ideas', 'креатив', 'creative', 'название', 'name', 'слоган', 'slogan'];
  if (creativeKeywords.some(kw => lowerQuestion.includes(kw))) {
    return 'creative';
  }
  
  // Simple questions (short, factual)
  if (question.length < 100 && (lowerQuestion.includes('что') || lowerQuestion.includes('what') || lowerQuestion.includes('когда') || lowerQuestion.includes('when') || lowerQuestion.includes('кто') || lowerQuestion.includes('who') || lowerQuestion.includes('где') || lowerQuestion.includes('where'))) {
    return 'simple';
  }
  
  return 'general';
}

// Recommend best provider for task type
export function recommendProvider(
  taskType: TaskType,
  availableProviders: Array<{ providerId: string; priority: number; isFree: boolean }>,
  preferFree: boolean = true
): string | null {
  // Filter providers that are configured
  const configuredProviders = availableProviders
    .map(ap => ({
      ...ap,
      config: getProvider(ap.providerId)
    }))
    .filter(p => p.config);
  
  if (configuredProviders.length === 0) {
    return null;
  }
  
  // Score each provider
  const scored = configuredProviders.map(p => {
    let score = p.priority * 10;
    
    // Check if any model is good for this task type
    const hasGoodModel = p.config!.models.some(m => m.bestFor.includes(taskType));
    if (hasGoodModel) {
      score += 50;
    }
    
    // Prefer free if requested
    if (preferFree && (p.isFree || p.config!.isFree)) {
      score += 30;
    }
    
    // Quality bonus
    const bestModel = p.config!.models.find(m => m.bestFor.includes(taskType)) || p.config!.models[0];
    if (bestModel.quality === 'excellent') score += 20;
    if (bestModel.quality === 'good') score += 10;
    
    // Speed bonus for simple tasks
    if (taskType === 'simple' && bestModel.speed === 'fast') {
      score += 15;
    }
    
    return { providerId: p.providerId, score };
  });
  
  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.providerId || null;
}

// Estimate cost for a request
export function estimateCost(providerId: string, estimatedTokens: number): { cost: number; isFree: boolean; display: string } {
  const provider = getProvider(providerId);
  if (!provider) {
    return { cost: 0, isFree: false, display: 'Неизвестно' };
  }
  
  if (provider.isFree || provider.costPer1kTokens === 0) {
    return { cost: 0, isFree: true, display: 'Бесплатно' };
  }
  
  const cost = (estimatedTokens / 1000) * provider.costPer1kTokens;
  if (cost < 0.001) {
    return { cost, isFree: false, display: '< $0.001' };
  }
  
  return { cost, isFree: false, display: `~$${cost.toFixed(4)}` };
}

// Call AI provider
export async function callAIProvider(
  providerId: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey?: string,
  baseUrl?: string
): Promise<{ content: string; tokensUsed?: number }> {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  
  // For now, use the built-in Manus LLM for all providers
  // In production, each provider would have its own API call implementation
  try {
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))
    });
    
    const messageContent = response.choices[0]?.message?.content;
    const content = typeof messageContent === 'string' ? messageContent : '';
    return {
      content,
      tokensUsed: response.usage?.total_tokens
    };
  } catch (error) {
    console.error(`Error calling ${providerId}:`, error);
    throw error;
  }
}

// Provider-specific implementations (to be expanded)
export async function callGeminiFree(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed?: number }> {
  // Gemini Free API implementation
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      }))
    })
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokensUsed: data.usageMetadata?.totalTokenCount
  };
}

export async function callOllama(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed?: number }> {
  // Ollama API implementation
  const url = `${baseUrl}/api/chat`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    content: data.message?.content || '',
    tokensUsed: data.eval_count
  };
}

export async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed?: number }> {
  // DeepSeek API (OpenAI-compatible)
  const url = 'https://api.deepseek.com/chat/completions';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages
    })
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens
  };
}

export async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed?: number }> {
  // Hugging Face Inference API
  const url = `https://api-inference.huggingface.co/models/${model}`;
  
  // Convert messages to prompt
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 2048,
        return_full_text: false
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Hugging Face API error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    content: Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '',
  };
}
