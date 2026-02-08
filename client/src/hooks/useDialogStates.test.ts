/**
 * Tests for useDialogStates hook
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDialogStates } from "./useDialogStates";

describe("useDialogStates", () => {
  describe("create dialogs", () => {
    it("should initialize with all dialogs closed", () => {
      const { result } = renderHook(() => useDialogStates());
      const { create } = result.current;

      expect(create.blockOpen).toBe(false);
      expect(create.sectionOpen).toBe(false);
      expect(create.taskOpen).toBe(false);
    });

    it("should initialize with empty form values", () => {
      const { result } = renderHook(() => useDialogStates());
      const { create } = result.current;

      expect(create.blockTitle).toBe("");
      expect(create.blockTitleRu).toBe("");
      expect(create.sectionTitle).toBe("");
      expect(create.taskTitle).toBe("");
      expect(create.taskDescription).toBe("");
    });

    it("should open block dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.openBlock();
      });

      expect(result.current.create.blockOpen).toBe(true);
    });

    it("should open section dialog with target block", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.openSection(42);
      });

      expect(result.current.create.sectionOpen).toBe(true);
      expect(result.current.create.targetBlockId).toBe(42);
    });

    it("should open task dialog with target section", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.openTask(123);
      });

      expect(result.current.create.taskOpen).toBe(true);
      expect(result.current.create.targetSectionId).toBe(123);
    });

    it("should close block dialog and reset form", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.openBlock();
        result.current.create.setBlockTitle("Test Block");
      });
      expect(result.current.create.blockOpen).toBe(true);

      act(() => {
        result.current.create.closeBlock();
      });

      expect(result.current.create.blockOpen).toBe(false);
      expect(result.current.create.blockTitle).toBe("");
    });

    it("should close section dialog and reset form", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.openSection(42);
        result.current.create.setSectionTitle("Test Section");
      });
      expect(result.current.create.sectionOpen).toBe(true);

      act(() => {
        result.current.create.closeSection();
      });

      expect(result.current.create.sectionOpen).toBe(false);
      expect(result.current.create.sectionTitle).toBe("");
      expect(result.current.create.targetBlockId).toBeNull();
    });

    it("should provide setBlockOpen for Dialog onOpenChange", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.setBlockOpen(true);
      });
      expect(result.current.create.blockOpen).toBe(true);

      act(() => {
        result.current.create.setBlockOpen(false);
      });
      expect(result.current.create.blockOpen).toBe(false);
    });

    it("should update form values", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.create.setBlockTitle("Block Title");
        result.current.create.setBlockTitleRu("Название блока");
        result.current.create.setSectionTitle("Section Title");
        result.current.create.setTaskTitle("Task Title");
        result.current.create.setTaskDescription("Task Description");
      });

      expect(result.current.create.blockTitle).toBe("Block Title");
      expect(result.current.create.blockTitleRu).toBe("Название блока");
      expect(result.current.create.sectionTitle).toBe("Section Title");
      expect(result.current.create.taskTitle).toBe("Task Title");
      expect(result.current.create.taskDescription).toBe("Task Description");
    });
  });

  describe("taskAction dialogs", () => {
    it("should initialize with all task action dialogs closed", () => {
      const { result } = renderHook(() => useDialogStates());
      const { taskAction } = result.current;

      expect(taskAction.splitOpen).toBe(false);
      expect(taskAction.mergeOpen).toBe(false);
      expect(taskAction.convertToSectionOpen).toBe(false);
      expect(taskAction.convertToTaskOpen).toBe(false);
      expect(taskAction.bulkActionsOpen).toBe(false);
    });

    it("should open split dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.taskAction.openSplit();
      });

      expect(result.current.taskAction.splitOpen).toBe(true);
    });

    it("should open merge dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.taskAction.openMerge();
      });

      expect(result.current.taskAction.mergeOpen).toBe(true);
    });

    it("should open convertToSection dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.taskAction.openConvertToSection();
      });

      expect(result.current.taskAction.convertToSectionOpen).toBe(true);
    });

    it("should close all task actions at once", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.taskAction.openSplit();
        result.current.taskAction.openMerge();
        result.current.taskAction.openBulkActions();
      });

      expect(result.current.taskAction.splitOpen).toBe(true);
      expect(result.current.taskAction.mergeOpen).toBe(true);
      expect(result.current.taskAction.bulkActionsOpen).toBe(true);

      act(() => {
        result.current.taskAction.closeAllTaskActions();
      });

      expect(result.current.taskAction.splitOpen).toBe(false);
      expect(result.current.taskAction.mergeOpen).toBe(false);
      expect(result.current.taskAction.bulkActionsOpen).toBe(false);
    });

    it("should provide setters for Dialog onOpenChange", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.taskAction.setSplitOpen(true);
      });
      expect(result.current.taskAction.splitOpen).toBe(true);

      act(() => {
        result.current.taskAction.setSplitOpen(false);
      });
      expect(result.current.taskAction.splitOpen).toBe(false);
    });
  });

  describe("feature dialogs", () => {
    it("should initialize with all feature dialogs closed", () => {
      const { result } = renderHook(() => useDialogStates());
      const { feature } = result.current;

      expect(feature.calendarOpen).toBe(false);
      expect(feature.saveTemplateOpen).toBe(false);
      expect(feature.pitchDeckOpen).toBe(false);
      expect(feature.aiAssistantOpen).toBe(false);
      expect(feature.riskPanelOpen).toBe(false);
      expect(feature.customFieldsOpen).toBe(false);
    });

    it("should open calendar dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.feature.openCalendar();
      });

      expect(result.current.feature.calendarOpen).toBe(true);
    });

    it("should open AI assistant dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.feature.openAIAssistant();
      });

      expect(result.current.feature.aiAssistantOpen).toBe(true);
    });

    it("should open risk panel dialog", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.feature.openRiskPanel();
      });

      expect(result.current.feature.riskPanelOpen).toBe(true);
    });

    it("should close all feature dialogs at once", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.feature.openCalendar();
        result.current.feature.openAIAssistant();
        result.current.feature.openRiskPanel();
      });

      expect(result.current.feature.calendarOpen).toBe(true);
      expect(result.current.feature.aiAssistantOpen).toBe(true);
      expect(result.current.feature.riskPanelOpen).toBe(true);

      act(() => {
        result.current.feature.closeAllFeatures();
      });

      expect(result.current.feature.calendarOpen).toBe(false);
      expect(result.current.feature.aiAssistantOpen).toBe(false);
      expect(result.current.feature.riskPanelOpen).toBe(false);
    });

    it("should provide setters for Dialog onOpenChange", () => {
      const { result } = renderHook(() => useDialogStates());

      act(() => {
        result.current.feature.setCalendarOpen(true);
      });
      expect(result.current.feature.calendarOpen).toBe(true);

      act(() => {
        result.current.feature.setCalendarOpen(false);
      });
      expect(result.current.feature.calendarOpen).toBe(false);
    });
  });
});
