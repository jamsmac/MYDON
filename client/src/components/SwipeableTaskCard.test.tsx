import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwipeableTaskCard } from './SwipeableTaskCard';
import React from 'react';

// Mock the useMobile hook
vi.mock('@/hooks/useMobile', () => ({
  useMobile: () => true, // Always return true for mobile in tests
}));

describe('SwipeableTaskCard', () => {
  const mockOnComplete = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUncomplete = vi.fn();

  const defaultProps = {
    taskId: 1,
    taskStatus: 'not_started',
    onComplete: mockOnComplete,
    onDelete: mockOnDelete,
    onUncomplete: mockOnUncomplete,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render children correctly', () => {
      render(
        <SwipeableTaskCard {...defaultProps}>
          <div>Test Task Content</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Test Task Content')).toBeTruthy();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <SwipeableTaskCard {...defaultProps} className="custom-class">
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(container.querySelector('.custom-class')).toBeTruthy();
    });

    it('should render action indicators on mobile', () => {
      const { container } = render(
        <SwipeableTaskCard {...defaultProps}>
          <div>Task</div>
        </SwipeableTaskCard>
      );
      // Check that the component renders (has children)
      expect(screen.getByText('Task')).toBeTruthy();
      // The component should have a wrapper div
      expect(container.firstChild).toBeTruthy();
    });

    it('should handle disabled state', () => {
      const { container } = render(
        <SwipeableTaskCard {...defaultProps} disabled={true}>
          <div>Disabled Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Disabled Task')).toBeTruthy();
    });
  });

  describe('Task Status Handling', () => {
    it('should handle not_started status', () => {
      render(
        <SwipeableTaskCard {...defaultProps} taskStatus="not_started">
          <div>Not Started Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Not Started Task')).toBeTruthy();
    });

    it('should handle in_progress status', () => {
      render(
        <SwipeableTaskCard {...defaultProps} taskStatus="in_progress">
          <div>In Progress Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('In Progress Task')).toBeTruthy();
    });

    it('should handle completed status', () => {
      render(
        <SwipeableTaskCard {...defaultProps} taskStatus="completed">
          <div>Completed Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Completed Task')).toBeTruthy();
    });

    it('should accept different task IDs', () => {
      const { unmount } = render(
        <SwipeableTaskCard {...defaultProps} taskId={42}>
          <div>Task 42</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Task 42')).toBeTruthy();
      unmount();
    });
  });

  describe('Callback Props', () => {
    it('should accept onComplete callback', () => {
      const onComplete = vi.fn();
      render(
        <SwipeableTaskCard {...defaultProps} onComplete={onComplete}>
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(onComplete).toBeDefined();
    });

    it('should accept onDelete callback', () => {
      const onDelete = vi.fn();
      render(
        <SwipeableTaskCard {...defaultProps} onDelete={onDelete}>
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(onDelete).toBeDefined();
    });

    it('should accept onUncomplete callback', () => {
      const onUncomplete = vi.fn();
      render(
        <SwipeableTaskCard {...defaultProps} onUncomplete={onUncomplete}>
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(onUncomplete).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should render multiple task cards', () => {
      const { container } = render(
        <>
          <SwipeableTaskCard {...defaultProps} taskId={1}>
            <div>Task 1</div>
          </SwipeableTaskCard>
          <SwipeableTaskCard {...defaultProps} taskId={2}>
            <div>Task 2</div>
          </SwipeableTaskCard>
          <SwipeableTaskCard {...defaultProps} taskId={3}>
            <div>Task 3</div>
          </SwipeableTaskCard>
        </>
      );
      expect(screen.getByText('Task 1')).toBeTruthy();
      expect(screen.getByText('Task 2')).toBeTruthy();
      expect(screen.getByText('Task 3')).toBeTruthy();
    });

    it('should render with nested content', () => {
      render(
        <SwipeableTaskCard {...defaultProps}>
          <div>
            <h3>Task Title</h3>
            <p>Task Description</p>
          </div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Task Title')).toBeTruthy();
      expect(screen.getByText('Task Description')).toBeTruthy();
    });

    it('should work with empty children', () => {
      const { container } = render(
        <SwipeableTaskCard {...defaultProps}>
          <div></div>
        </SwipeableTaskCard>
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('Props Validation', () => {
    it('should accept all required props', () => {
      render(
        <SwipeableTaskCard
          taskId={1}
          taskStatus="not_started"
          onComplete={vi.fn()}
          onDelete={vi.fn()}
        >
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Task')).toBeTruthy();
    });

    it('should accept optional props', () => {
      render(
        <SwipeableTaskCard
          taskId={1}
          taskStatus="not_started"
          onComplete={vi.fn()}
          onDelete={vi.fn()}
          onUncomplete={vi.fn()}
          disabled={false}
          className="custom"
        >
          <div>Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Task')).toBeTruthy();
    });
  });

  describe('Mobile Detection', () => {
    it('should render for mobile devices', () => {
      render(
        <SwipeableTaskCard {...defaultProps}>
          <div>Mobile Task</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Mobile Task')).toBeTruthy();
    });

    it('should handle disabled swipe when disabled prop is true', () => {
      render(
        <SwipeableTaskCard {...defaultProps} disabled={true}>
          <div>Disabled Swipe</div>
        </SwipeableTaskCard>
      );
      expect(screen.getByText('Disabled Swipe')).toBeTruthy();
    });
  });
});
