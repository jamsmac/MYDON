/**
 * EmptyStatePanel - Empty state shown when no block/section/task is selected
 * Extracted from ProjectView.tsx
 */

import { Layers } from 'lucide-react';

export function EmptyStatePanel() {
  return (
    <div className="flex-1 flex items-center justify-center text-slate-500">
      <div className="text-center">
        <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Выберите блок, раздел или задачу</p>
        <p className="text-sm mt-2">или создайте новый блок</p>
      </div>
    </div>
  );
}
