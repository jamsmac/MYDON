/**
 * AI Provider Adapters
 * Unified interface for different AI providers
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { invokeLLM } from '../_core/llm';
import type { AIMessage, AIResponse, AIProvider, AIRequestOptions } from './aiTypes';
import { PROVIDER_COSTS } from './aiTypes';

// Provider instances (lazy initialized)
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let googleClient: GoogleGenerativeAI | null = null;

/**
 * Get or create OpenAI client
 */
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Get or create Anthropic client
 */
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Get or create Google AI client
 */
function getGoogleClient(): GoogleGenerativeAI | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  if (!googleClient) {
    googleClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  }
  return googleClient;
}

/**
 * Calculate cost based on token usage
 */
function calculateCost(provider: AIProvider, promptTokens: number, completionTokens: number): number {
  const costs = PROVIDER_COSTS[provider];
  return (promptTokens / 1000) * costs.input + (completionTokens / 1000) * costs.output;
}

/**
 * OpenAI Provider Adapter
 */
export async function callOpenAI(options: AIRequestOptions): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getOpenAIClient();
  
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  const model = options.model || 'gpt-4-turbo-preview';
  
  const response = await client.chat.completions.create({
    model,
    messages: options.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  });

  const content = response.choices[0]?.message?.content || '';
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;

  return {
    content,
    model,
    provider: 'openai',
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    cost: calculateCost('openai', promptTokens, completionTokens),
    fromCache: false,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Anthropic Provider Adapter
 */
export async function callAnthropic(options: AIRequestOptions): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getAnthropicClient();
  
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  const model = options.model || 'claude-3-sonnet-20240229';
  
  // Extract system message if present
  const systemMessage = options.messages.find(m => m.role === 'system');
  const otherMessages = options.messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    system: systemMessage?.content,
    messages: otherMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const promptTokens = response.usage?.input_tokens || 0;
  const completionTokens = response.usage?.output_tokens || 0;

  return {
    content,
    model,
    provider: 'anthropic',
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    cost: calculateCost('anthropic', promptTokens, completionTokens),
    fromCache: false,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Google AI Provider Adapter
 */
export async function callGoogle(options: AIRequestOptions): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getGoogleClient();
  
  if (!client) {
    throw new Error('Google AI API key not configured');
  }

  const modelName = options.model || 'gemini-pro';
  const model = client.getGenerativeModel({ model: modelName });

  // Convert messages to Google format
  const history = options.messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMessage = options.messages[options.messages.length - 1];
  
  const chat = model.startChat({ history: history as any });
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  const content = response.text();
  // Google doesn't provide token counts in the same way
  const estimatedTokens = Math.ceil((options.messages.reduce((sum, m) => sum + m.content.length, 0) + content.length) / 4);

  return {
    content,
    model: modelName,
    provider: 'google',
    tokens: {
      prompt: Math.ceil(estimatedTokens * 0.3),
      completion: Math.ceil(estimatedTokens * 0.7),
      total: estimatedTokens,
    },
    cost: calculateCost('google', estimatedTokens * 0.3, estimatedTokens * 0.7),
    fromCache: false,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Built-in LLM Provider Adapter (uses Manus built-in)
 */
export async function callBuiltin(options: AIRequestOptions): Promise<AIResponse> {
  const startTime = Date.now();

  const response = await invokeLLM({
    messages: options.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const messageContent = response.choices?.[0]?.message?.content;
  const content = typeof messageContent === 'string' ? messageContent : '';
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;

  return {
    content,
    model: 'builtin',
    provider: 'builtin',
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    cost: 0, // Built-in is free
    fromCache: false,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'google':
      return !!process.env.GOOGLE_AI_API_KEY;
    case 'builtin':
      return true; // Always available
    default:
      return false;
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = ['builtin'];
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.GOOGLE_AI_API_KEY) providers.push('google');
  return providers;
}
