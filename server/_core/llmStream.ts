import { ENV } from "./env";
import { Message, MessageContent, TextContent, ImageContent, FileContent, Tool, ToolChoice, ToolChoiceExplicit } from "./llm";

// Normalized content part (what we send to the API)
type NormalizedContentPart = TextContent | ImageContent | FileContent;

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (part: MessageContent): NormalizedContentPart => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  return part;
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }
    if (tools.length > 1) {
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    }
    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: (toolChoice as { name: string }).name } };
  }

  return toolChoice as ToolChoiceExplicit;
};

// Check if using OpenRouter API
const isOpenRouter = () =>
  ENV.forgeApiUrl?.includes("openrouter.ai") ?? false;

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://openrouter.ai/api/v1/chat/completions";

// Default model for OpenRouter (fast and cheap)
const DEFAULT_MODEL = isOpenRouter()
  ? "google/gemini-2.0-flash-001"
  : "gemini-2.5-flash";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("AI API key is not configured. Set BUILT_IN_FORGE_API_KEY or OPENROUTER_API_KEY");
  }
};

// Build headers for API request
const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "authorization": `Bearer ${ENV.forgeApiKey}`,
  };

  // OpenRouter-specific headers
  if (isOpenRouter()) {
    headers["HTTP-Referer"] = process.env.VITE_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "MYDON Roadmap";
  }

  return headers;
};

export type StreamParams = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
};

/**
 * Stream LLM responses using Server-Sent Events format
 * Returns a ReadableStream that can be piped to the response
 */
export async function streamLLM(params: StreamParams): Promise<ReadableStream<Uint8Array>> {
  assertApiKey();

  const { messages, model, tools, toolChoice, tool_choice, maxTokens, max_tokens } = params;

  const payload: Record<string, unknown> = {
    model: model || DEFAULT_MODEL,
    messages: messages.map(normalizeMessage),
    stream: true,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = maxTokens || max_tokens || 4096;

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM stream failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  if (!response.body) {
    throw new Error("No response body for streaming");
  }

  return response.body;
}

/**
 * Parse SSE stream and extract content chunks
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
