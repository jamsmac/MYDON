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
import { useMobile } from '@/hooks/useMobile';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { isMobile } = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <div className="flex h-screen overflow-hidden bg-background relative">
            {/* Mobile header with hamburger */}
            {isMobile && (
              <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar border-b border-sidebar-border flex items-center px-3 gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
                >
                  {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">T</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-sidebar-foreground">TechRent</span>
                </div>
              </div>
            )}

            {/* Sidebar - overlay on mobile, fixed on desktop */}
            {isMobile ? (
              <>
                {/* Backdrop */}
                {sidebarOpen && (
                  <div 
                    className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
                    onClick={() => setSidebarOpen(false)}
                  />
                )}
                {/* Slide-over sidebar */}
                <div className={`fixed top-12 left-0 bottom-0 z-40 w-[85vw] max-w-[320px] transition-transform duration-300 ease-in-out ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                  <Sidebar onNavigate={() => setSidebarOpen(false)} />
                </div>
              </>
            ) : (
              <Sidebar />
            )}

            {/* Main content - full width on mobile with top padding for header */}
            <div className={`flex-1 ${isMobile ? 'pt-12' : ''}`}>
              <MainContent />
            </div>
          </div>
        </FilterProvider>
      </DeadlineProvider>
    </RoadmapProvider>
  );
}
