/* 
 * TechRent Roadmap Manager - Home Page
 * Design: Industrial Blueprint
 * - Primary: Deep slate (#1e293b) for authority
 * - Accent: Amber (#f59e0b) for progress, Emerald (#10b981) for completion
 * - Typography: JetBrains Mono for headers, Inter for body
 */

import { Sidebar } from '@/components/Sidebar';
import { MainContent } from '@/components/MainContent';
import { RoadmapProvider } from '@/contexts/RoadmapContext';
import { DeadlineProvider } from '@/contexts/DeadlineContext';

export default function Home() {
  return (
    <RoadmapProvider>
      <DeadlineProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <MainContent />
        </div>
      </DeadlineProvider>
    </RoadmapProvider>
  );
}
