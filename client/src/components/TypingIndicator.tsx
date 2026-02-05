import { cn } from "@/lib/utils";

interface TypingUser {
  userId: number;
  userName: string;
}

interface TypingIndicatorProps {
  users: TypingUser[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].userName} печатает`;
    } else if (users.length === 2) {
      return `${users[0].userName} и ${users[1].userName} печатают`;
    } else {
      return `${users[0].userName} и ещё ${users.length - 1} печатают`;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-slate-400 py-2 px-3 animate-in fade-in duration-200",
        className
      )}
    >
      <div className="flex items-center gap-0.5">
        <span
          className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "600ms" }}
        />
        <span
          className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "600ms" }}
        />
        <span
          className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "600ms" }}
        />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}

// Compact version for inline use
interface TypingDotsProps {
  className?: string;
}

export function TypingDots({ className }: TypingDotsProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "0ms", animationDuration: "600ms" }}
      />
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className="w-1 h-1 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </span>
  );
}
