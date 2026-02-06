import { ChevronRight, Home, Layers, FolderOpen, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  type: "project" | "block" | "section" | "task";
  id: number;
  title: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
  className?: string;
}

const TYPE_ICONS = {
  project: Home,
  block: Layers,
  section: FolderOpen,
  task: CheckSquare,
};

const TYPE_COLORS = {
  project: "text-blue-400",
  block: "text-amber-400",
  section: "text-emerald-400",
  task: "text-purple-400",
};

export function BreadcrumbNav({ items, onNavigate, className }: BreadcrumbNavProps) {
  if (items.length === 0) return null;

  return (
    <nav className={cn("flex items-center gap-1 text-xs overflow-x-auto", className)}>
      {items.map((item, index) => {
        const Icon = TYPE_ICONS[item.type];
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.type}-${item.id}`} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
            )}
            <button
              onClick={() => !isLast && onNavigate(item)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors truncate max-w-[140px]",
                isLast
                  ? "text-slate-200 font-medium cursor-default"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
              )}
              disabled={isLast}
            >
              <Icon className={cn("w-3 h-3 flex-shrink-0", TYPE_COLORS[item.type])} />
              <span className="truncate">{item.title}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
