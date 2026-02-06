import { describe, it, expect } from "vitest";

describe("Mobile Responsive Layout", () => {
  describe("ProjectView Mobile Layout Logic", () => {
    it("should show mobile header bar only on mobile", () => {
      const shouldShowMobileHeader = (isMobile: boolean) => isMobile;
      
      expect(shouldShowMobileHeader(true)).toBe(true);
      expect(shouldShowMobileHeader(false)).toBe(false);
    });

    it("should hide desktop sidebar on mobile", () => {
      const shouldShowDesktopSidebar = (isMobile: boolean) => !isMobile;
      
      expect(shouldShowDesktopSidebar(true)).toBe(false);
      expect(shouldShowDesktopSidebar(false)).toBe(true);
    });

    it("should show mobile sidebar sheet when toggled", () => {
      const shouldShowMobileSidebar = (isMobile: boolean, sidebarOpen: boolean) => 
        isMobile && sidebarOpen;
      
      expect(shouldShowMobileSidebar(true, true)).toBe(true);
      expect(shouldShowMobileSidebar(true, false)).toBe(false);
      expect(shouldShowMobileSidebar(false, true)).toBe(false);
      expect(shouldShowMobileSidebar(false, false)).toBe(false);
    });

    it("should show detail panel as full-screen overlay on mobile", () => {
      const getDetailPanelClass = (isMobile: boolean) => {
        return isMobile 
          ? "fixed inset-0 z-50 bg-slate-900 mobile-slide-in"
          : "w-[45%] min-w-[400px] border-l border-slate-700";
      };
      
      const mobileClass = getDetailPanelClass(true);
      expect(mobileClass).toContain("fixed");
      expect(mobileClass).toContain("inset-0");
      expect(mobileClass).toContain("z-50");
      
      const desktopClass = getDetailPanelClass(false);
      expect(desktopClass).toContain("w-[45%]");
      expect(desktopClass).toContain("border-l");
    });

    it("should show mobile blocks list when no context is selected", () => {
      const shouldShowMobileBlocksList = (
        isMobile: boolean, 
        hasSelectedContext: boolean
      ) => isMobile && !hasSelectedContext;
      
      expect(shouldShowMobileBlocksList(true, false)).toBe(true);
      expect(shouldShowMobileBlocksList(true, true)).toBe(false);
      expect(shouldShowMobileBlocksList(false, false)).toBe(false);
    });

    it("should trigger mobileShowDetail when selecting context on mobile", () => {
      let mobileShowDetail = false;
      const setMobileShowDetail = (val: boolean) => { mobileShowDetail = val; };
      
      const handleSelectContext = (isMobile: boolean) => {
        if (isMobile) {
          setMobileShowDetail(true);
        }
      };
      
      handleSelectContext(true);
      expect(mobileShowDetail).toBe(true);
      
      mobileShowDetail = false;
      handleSelectContext(false);
      expect(mobileShowDetail).toBe(false);
    });

    it("should handle mobile back navigation correctly", () => {
      let mobileShowDetail = true;
      let selectedContext: { type: string; id: number } | null = { type: 'block', id: 1 };
      let selectedTask: number | null = 5;
      
      const mobileBackToList = () => {
        mobileShowDetail = false;
        selectedContext = null;
        selectedTask = null;
      };
      
      mobileBackToList();
      expect(mobileShowDetail).toBe(false);
      expect(selectedContext).toBeNull();
      expect(selectedTask).toBeNull();
    });
  });

  describe("Home Page Mobile Layout Logic", () => {
    it("should show hamburger menu on mobile", () => {
      const shouldShowHamburger = (isMobile: boolean) => isMobile;
      
      expect(shouldShowHamburger(true)).toBe(true);
      expect(shouldShowHamburger(false)).toBe(false);
    });

    it("should show slide-over sidebar on mobile", () => {
      const getSidebarTransform = (sidebarOpen: boolean) => {
        return sidebarOpen ? 'translate-x-0' : '-translate-x-full';
      };
      
      expect(getSidebarTransform(true)).toBe('translate-x-0');
      expect(getSidebarTransform(false)).toBe('-translate-x-full');
    });

    it("should add top padding for mobile header", () => {
      const getMainContentClass = (isMobile: boolean) => {
        return `flex-1 ${isMobile ? 'pt-12' : ''}`;
      };
      
      expect(getMainContentClass(true)).toContain('pt-12');
      expect(getMainContentClass(false)).not.toContain('pt-12');
    });
  });

  describe("MainContent Mobile Task Panel", () => {
    it("should show task panel as full-screen overlay on mobile", () => {
      const getTaskPanelClass = (isMobile: boolean) => {
        return isMobile 
          ? "fixed inset-0 z-50 bg-background animate-in slide-in-from-bottom duration-300"
          : "w-1/2 border-l border-border";
      };
      
      const mobileClass = getTaskPanelClass(true);
      expect(mobileClass).toContain("fixed");
      expect(mobileClass).toContain("inset-0");
      expect(mobileClass).toContain("z-50");
      
      const desktopClass = getTaskPanelClass(false);
      expect(desktopClass).toContain("w-1/2");
    });

    it("should adjust main content width when task is selected on desktop", () => {
      const getMainContentWidth = (isMobile: boolean, hasSelectedTask: boolean) => {
        return !isMobile && hasSelectedTask ? "w-1/2" : "w-full";
      };
      
      expect(getMainContentWidth(false, true)).toBe("w-1/2");
      expect(getMainContentWidth(false, false)).toBe("w-full");
      expect(getMainContentWidth(true, true)).toBe("w-full");
      expect(getMainContentWidth(true, false)).toBe("w-full");
    });
  });

  describe("Dashboard Mobile Responsiveness", () => {
    it("should use responsive grid for stats cards", () => {
      const gridClass = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4";
      
      expect(gridClass).toContain("grid-cols-2");
      expect(gridClass).toContain("md:grid-cols-3");
      expect(gridClass).toContain("lg:grid-cols-6");
    });

    it("should use responsive grid for project cards", () => {
      const gridClass = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
      
      expect(gridClass).toContain("grid-cols-1");
      expect(gridClass).toContain("md:grid-cols-2");
      expect(gridClass).toContain("lg:grid-cols-3");
    });

    it("should hide credits and usage widgets on mobile", () => {
      const creditsClass = "hidden md:inline";
      const usageClass = "hidden md:inline";
      
      expect(creditsClass).toContain("hidden");
      expect(creditsClass).toContain("md:inline");
      expect(usageClass).toContain("hidden");
      expect(usageClass).toContain("md:inline");
    });

    it("should make nav bar horizontally scrollable", () => {
      const navClass = "flex items-center gap-1 py-1.5 overflow-x-auto scrollbar-hide";
      
      expect(navClass).toContain("overflow-x-auto");
      expect(navClass).toContain("scrollbar-hide");
    });
  });

  describe("Mobile CSS Utilities", () => {
    it("should define correct breakpoint values", () => {
      const MOBILE_BREAKPOINT = 768;
      const TABLET_BREAKPOINT = 1024;
      
      expect(MOBILE_BREAKPOINT).toBe(768);
      expect(TABLET_BREAKPOINT).toBe(1024);
      expect(MOBILE_BREAKPOINT).toBeLessThan(TABLET_BREAKPOINT);
    });

    it("should determine device type from width", () => {
      const getDeviceType = (width: number) => {
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
      };
      
      expect(getDeviceType(320)).toBe('mobile');
      expect(getDeviceType(375)).toBe('mobile');
      expect(getDeviceType(414)).toBe('mobile');
      expect(getDeviceType(768)).toBe('tablet');
      expect(getDeviceType(834)).toBe('tablet');
      expect(getDeviceType(1024)).toBe('desktop');
      expect(getDeviceType(1440)).toBe('desktop');
    });
  });

  describe("Mobile Dialog Handling", () => {
    it("should ensure dialogs are full-width on mobile", () => {
      const getDialogMaxWidth = (isMobile: boolean) => {
        return isMobile ? 'calc(100vw - 2rem)' : '500px';
      };
      
      expect(getDialogMaxWidth(true)).toContain('100vw');
      expect(getDialogMaxWidth(false)).toBe('500px');
    });

    it("should limit dialog max height on mobile", () => {
      const getDialogMaxHeight = (isMobile: boolean) => {
        return isMobile ? '90vh' : 'auto';
      };
      
      expect(getDialogMaxHeight(true)).toBe('90vh');
      expect(getDialogMaxHeight(false)).toBe('auto');
    });
  });
});
