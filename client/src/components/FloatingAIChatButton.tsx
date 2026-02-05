/**
 * FloatingAIChatButton - Global AI chat button visible on all pages
 * 
 * Three modes:
 * - Minimized: Floating button only
 * - Popup: 420x650px window in bottom-right corner
 * - Docked: Full-height side panel (resizable)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  X, 
  Minimize2, 
  Maximize2,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Brain
} from "lucide-react";
import { FloatingAIChatContent } from "./FloatingAIChatContent";

type ChatMode = "minimized" | "popup" | "docked";

interface FloatingAIChatButtonProps {
  projectId?: number;
  taskId?: string;
}

const STORAGE_KEY = "floating-ai-chat-state";
const MIN_DOCK_WIDTH = 320;
const MAX_DOCK_WIDTH = 600;
const DEFAULT_DOCK_WIDTH = 420;

interface StoredState {
  mode: ChatMode;
  dockWidth: number;
}

export function FloatingAIChatButton({ projectId, taskId }: FloatingAIChatButtonProps) {
  const [mode, setMode] = useState<ChatMode>("minimized");
  const [dockWidth, setDockWidth] = useState(DEFAULT_DOCK_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

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
            {contextLoaded && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-400 border border-white" />
            )}
            {/* Unread indicator */}
            {hasUnread && (
              <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-amber-400 border border-white animate-ping" />
            )}
          </div>
        </Button>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
            AI Ассистент (⌘J)
          </div>
        </div>
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
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Ассистент</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {contextLoaded && <Brain className="h-3 w-3 text-green-500" />}
                  {contextLoaded ? "Контекст загружен" : "Готов к работе"}
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
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Ассистент</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {contextLoaded && <Brain className="h-3 w-3 text-green-500" />}
                  {contextLoaded ? "Контекст загружен" : "Готов к работе"}
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
