/**
 * ProjectLoadingStates - Loading and error states for ProjectView
 * Extracted from ProjectView.tsx
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getLoginUrl } from '@/const';

export function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );
}

export function ProjectNotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Проект не найден</p>
        <Link href="/">
          <Button variant="outline">Вернуться на главную</Button>
        </Link>
      </div>
    </div>
  );
}

export function redirectToLogin(): null {
  window.location.href = getLoginUrl();
  return null;
}
