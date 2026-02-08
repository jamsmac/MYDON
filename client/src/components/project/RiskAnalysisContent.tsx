/**
 * Risk Analysis Content Component
 * Displays AI-detected risks for a project
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RiskItem {
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  taskId?: number;
  blockId?: number;
}

interface RiskAnalysisContentProps {
  projectId: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 border-red-500 text-red-400',
  high: 'bg-orange-500/20 border-orange-500 text-orange-400',
  medium: 'bg-amber-500/20 border-amber-500 text-amber-400',
  low: 'bg-blue-500/20 border-blue-500 text-blue-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export function RiskAnalysisContent({ projectId }: RiskAnalysisContentProps) {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const detectRisks = trpc.aiEnhancements.detectRisks.useMutation({
    onSuccess: (data) => {
      setRisks(data.risks);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
    }
  });

  // Run detection on mount
  if (!detectRisks.isPending && risks.length === 0 && isLoading) {
    detectRisks.mutate({ projectId });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Анализируем риски...</span>
      </div>
    );
  }

  if (!risks || risks.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">Риски не обнаружены</p>
        <p className="text-slate-500 text-sm mt-1">Проект в хорошем состоянии</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {risks.map((risk: RiskItem, index: number) => (
        <div
          key={index}
          className={cn(
            "p-4 rounded-lg border",
            SEVERITY_COLORS[risk.severity] || SEVERITY_COLORS.medium
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="font-medium text-white">{risk.type}</span>
            <span className="text-xs px-2 py-1 rounded bg-slate-800">
              {SEVERITY_LABELS[risk.severity] || risk.severity}
            </span>
          </div>
          <p className="text-sm text-slate-300 mb-2">{risk.description}</p>
          {risk.recommendation && (
            <p className="text-xs text-emerald-400 mt-2">
              Рекомендация: {risk.recommendation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
