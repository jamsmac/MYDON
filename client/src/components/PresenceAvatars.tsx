import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PresenceUser {
  id: number;
  name: string;
  avatar?: string;
  color: string;
}

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PresenceAvatars({
  users,
  maxVisible = 5,
  size = "md",
  className,
}: PresenceAvatarsProps) {
  const [showAll, setShowAll] = useState(false);

  if (users.length === 0) return null;

  const visibleUsers = showAll ? users : users.slice(0, maxVisible);
  const hiddenCount = users.length - maxVisible;

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {visibleUsers.map((user, index) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "rounded-full border-2 border-slate-900 flex items-center justify-center font-medium cursor-default transition-transform hover:scale-110 hover:z-10",
                  sizeClasses[size]
                )}
                style={{
                  backgroundColor: user.color,
                  zIndex: visibleUsers.length - index,
                }}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white">{getInitials(user.name)}</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: "#22c55e" }}
                />
                <span className="text-white">{user.name}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {!showAll && hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowAll(true)}
                className={cn(
                  "rounded-full border-2 border-slate-900 flex items-center justify-center font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors",
                  sizeClasses[size]
                )}
                style={{ zIndex: 0 }}
              >
                +{hiddenCount}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
              <div className="text-white">
                {users.slice(maxVisible).map((u) => u.name).join(", ")}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {users.length > 0 && (
        <div className="ml-3 flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {users.length} {users.length === 1 ? "онлайн" : "онлайн"}
          </span>
        </div>
      )}
    </div>
  );
}
