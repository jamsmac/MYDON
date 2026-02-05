/* 
 * MYDON Roadmap Hub - Home Page
 * Design: Industrial Blueprint
 * - Primary: Deep slate (#1e293b) for authority
 * - Accent: Amber (#f59e0b) for progress, Emerald (#10b981) for completion
 * - Typography: JetBrains Mono for headers, Inter for body
 */

import { useAuth } from '@/_core/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { MainContent } from '@/components/MainContent';
import { RoadmapProvider } from '@/contexts/RoadmapContext';
import { DeadlineProvider } from '@/contexts/DeadlineContext';
import { FilterProvider } from '@/contexts/FilterContext';

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <RoadmapProvider>
      <DeadlineProvider>
        <FilterProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <MainContent />
          </div>
        </FilterProvider>
      </DeadlineProvider>
    </RoadmapProvider>
  );
}
