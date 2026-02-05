/**
 * FloatingAIChatButton - Global AI chat button visible on all pages
 * 
 * Three modes:
 * - Minimized: Floating button only
 * - Popup: 420x650px window in bottom-right corner
 * - Docked: Full-height side panel (resizable)
 * 
 * Automatically picks up project/task context from AIChatContext
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Brain,
  FolderOpen,
  FileText
} from "lucide-react";
import { FloatingAIChatContent } from "./FloatingAIChatContent";
import { useOptionalAIChatContext } from "@/contexts/AIChatContext";

type ChatMode = "minimized" | "popup" | "docked";

const STORAGE_KEY = "floating-ai-chat-state";
const MIN_DOCK_WIDTH = 320;
const MAX_DOCK_WIDTH = 600;
const DEFAULT_DOCK_WIDTH = 420;

interface StoredState {
  mode: ChatMode;
  dockWidth: number;
}

export function FloatingAIChatButton() {
  const [mode, setMode] = useState<ChatMode>("minimized");
  const [dockWidth, setDockWidth] = useState(DEFAULT_DOCK_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  // Get context from AIChatContext
  const aiChatContext = useOptionalAIChatContext();
  const projectId = aiChatContext?.projectId;
  const projectName = aiChatContext?.projectName;
  const taskId = aiChatContext?.taskId;
  const taskTitle = aiChatContext?.taskTitle;
  const hasContext = aiChatContext?.hasContext || false;
  const contextLabel = aiChatContext?.contextLabel || "";

  // Load persisted state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: StoredState = JSON.parse(stored);
        // Don't restore mode automatically - start minimized
        setDockWidth(state.dockWidth || DEFAULT_DOCK_WIDTH);
      }
    } catch (e) {
      console.error("Failed to load chat state:", e);
    }
  }, []);

  // Save state on change
  useEffect(() => {
    try {
      const state: StoredState = { mode, dockWidth };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save chat state:", e);
    }
  }, [mode, dockWidth]);

  // Keyboard shortcut (Cmd/Ctrl + J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggleChat();
      }
      // Escape to minimize
      if (e.key === "Escape" && mode !== "minimized") {
        setMode("minimized");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Handle resize for docked mode
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setDockWidth(Math.min(MAX_DOCK_WIDTH, Math.max(MIN_DOCK_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const toggleChat = useCallback(() => {
    setMode(prev => prev === "minimized" ? "popup" : "minimized");
    setHasUnread(false);
  }, []);

  const switchToDocked = useCallback(() => {
    setMode("docked");
  }, []);

  const switchToPopup = useCallback(() => {
    setMode("popup");
  }, []);

  const handleNewMessage = useCallback(() => {
    if (mode === "minimized") {
      setHasUnread(true);
    }
  }, [mode]);

  const handleContextLoaded = useCallback((loaded: boolean) => {
    setContextLoaded(loaded);
  }, []);

  // Context badge component
  const ContextBadge = () => {
    if (!hasContext) return null;
    
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 rounded-md text-xs">
        {projectName && (
          <span className="flex items-center gap-1 text-purple-400">
            <FolderOpen className="h-3 w-3" />
            <span className="max-w-[100px] truncate">{projectName}</span>
          </span>
        )}
        {taskTitle && (
          <>
            <span className="text-muted-foreground">→</span>
            <span className="flex items-center gap-1 text-amber-400">
              <FileText className="h-3 w-3" />
              <span className="max-w-[100px] truncate">{taskTitle}</span>
            </span>
          </>
        )}
      </div>
    );
  };

  // Minimized button
  if (mode === "minimized") {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <Button
          onClick={toggleChat}
          size="lg"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg",
            "bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
            "transition-all duration-300 hover:scale-110",
            hasUnread && "animate-pulse ring-2 ring-purple-400 ring-offset-2 ring-offset-background"
          )}
        >
          <div className="relative">
            <Sparkles className="h-6 w-6 text-white" />
            {/* Context indicator */}
            {(contextLoaded || hasContext) && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-400 border border-white" />
            )}
            {/* Unread indicator */}
            {hasUnread && (
              <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-amber-400 border border-white animate-ping" />
            )}
          </div>
        </Button>
        {/* Context tooltip on hover */}
        {hasContext && (
          <div className="absolute bottom-full right-0 mb-2 pointer-events-none">
            <div className="bg-popover text-popover-foreground text-xs px-3 py-2 rounded-lg shadow-lg border border-border whitespace-nowrap">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-green-500" />
                <span className="text-muted-foreground">Контекст:</span>
                <span className="font-medium max-w-[200px] truncate">{contextLabel}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Popup mode
  if (mode === "popup") {
    return (
      <div 
        className="fixed bottom-6 right-6 z-[9999] w-[420px] h-[650px] max-h-[calc(100vh-48px)]"
        style={{ maxWidth: "calc(100vw - 48px)" }}
      >
        <div className="flex flex-col h-full bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Ассистент</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {(contextLoaded || hasContext) && <Brain className="h-3 w-3 text-green-500" />}
                    {hasContext ? "Контекст активен" : contextLoaded ? "Контекст загружен" : "Готов к работе"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={switchToDocked}
                  title="Закрепить сбоку"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMode("minimized")}
                  title="Свернуть"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMode("minimized")}
                  title="Закрыть"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Context badge */}
            <ContextBadge />
          </div>

          {/* Content */}
          <FloatingAIChatContent
            projectId={projectId}
            taskId={taskId}
            onNewMessage={handleNewMessage}
            onContextLoaded={handleContextLoaded}
          />
        </div>
      </div>
    );
  }

  // Docked mode
  return (
    <>
      {/* Overlay for clicking outside */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm md:hidden"
        onClick={() => setMode("minimized")}
      />
      
      {/* Docked panel */}
      <div 
        className="fixed top-0 right-0 bottom-0 z-[9999] bg-background border-l border-border shadow-2xl flex"
        style={{ width: dockWidth }}
      >
        {/* Resize handle */}
        <div
          ref={resizeRef}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize",
            "hover:bg-purple-500/50 transition-colors",
            isResizing && "bg-purple-500"
          )}
          onMouseDown={() => setIsResizing(true)}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Ассистент</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {(contextLoaded || hasContext) && <Brain className="h-3 w-3 text-green-500" />}
                    {hasContext ? "Контекст активен" : contextLoaded ? "Контекст загружен" : "Готов к работе"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={switchToPopup}
                  title="Открепить"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMode("minimized")}
                  title="Закрыть"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Context badge */}
            <ContextBadge />
          </div>

          {/* Content */}
          <FloatingAIChatContent
            projectId={projectId}
            taskId={taskId}
            onNewMessage={handleNewMessage}
            onContextLoaded={handleContextLoaded}
          />
        </div>
      </div>
    </>
  );
}

export default FloatingAIChatButton;
