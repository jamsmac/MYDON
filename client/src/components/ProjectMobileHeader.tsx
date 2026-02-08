/**
 * ProjectMobileHeader - Mobile header for ProjectView
 * Extracted from ProjectView.tsx
 */

import { Button } from '@/components/ui/button';
import { ChevronLeft, PanelLeft, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

interface ProjectMobileHeaderProps {
  projectName: string;
  mobileShowDetail: boolean;
  selectedTaskTitle?: string;
  selectedContextTitle?: string;
  progressCompleted: number;
  progressTotal: number;
  onBackToList: () => void;
  onOpenSidebar: () => void;
}

export function ProjectMobileHeader({
  projectName,
  mobileShowDetail,
  selectedTaskTitle,
  selectedContextTitle,
  progressCompleted,
  progressTotal,
  onBackToList,
  onOpenSidebar,
}: ProjectMobileHeaderProps) {
  const displayTitle = mobileShowDetail && selectedTaskTitle
    ? selectedTaskTitle
    : mobileShowDetail && selectedContextTitle
      ? selectedContextTitle
      : projectName;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center px-3 gap-2">
      {mobileShowDetail ? (
        <button
          onClick={onBackToList}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={onOpenSidebar}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-white truncate">
          {displayTitle}
        </h1>
        {!mobileShowDetail && (
          <p className="text-xs text-slate-500">
            {progressCompleted}/{progressTotal} задач
          </p>
        )}
      </div>
      <Link href="/">
        <Button variant="ghost" size="icon" className="text-slate-400 h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
