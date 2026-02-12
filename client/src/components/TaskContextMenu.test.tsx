import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskContextMenu, generateTaskContextActions } from './TaskContextMenu';
import { Check, Trash2 } from 'lucide-react';

describe('TaskContextMenu', () => {
  const mockActions = [
    {
      id: 'complete',
      label: 'Mark as complete',
      icon: <Check className="w-4 h-4" />,
      onClick: vi.fn(),
    },
    {
      id: 'delete',
      label: 'Delete task',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: vi.fn(),
      variant: 'destructive' as const,
    },
  ];

  const defaultProps = {
    taskId: 1,
    taskStatus: 'not_started',
    position: { x: 100, y: 100 },
    isOpen: true,
    onClose: vi.fn(),
    actions: mockActions,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <TaskContextMenu {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeFalsy();
    });

    it('should not render when position is null', () => {
      const { container } = render(
        <TaskContextMenu {...defaultProps} position={null} />
      );
      expect(container.firstChild).toBeFalsy();
    });

    it('should render menu when isOpen and position are provided', () => {
      const { container } = render(
        <TaskContextMenu {...defaultProps} />
      );
      expect(container.querySelector('[class*="fixed"]')).toBeTruthy();
    });

    it('should display task ID in header', () => {
      render(<TaskContextMenu {...defaultProps} taskId={42} />);
      expect(screen.getByText('Task #42')).toBeTruthy();
    });

    it('should display task status in header', () => {
      render(
        <TaskContextMenu {...defaultProps} taskStatus="in_progress" />
      );
      expect(screen.getByText(/in_progress/i)).toBeTruthy();
    });
  });

  describe('Actions', () => {
    it('should render all provided actions', () => {
      render(<TaskContextMenu {...defaultProps} />);
      expect(screen.getByText('Mark as complete')).toBeTruthy();
      expect(screen.getByText('Delete task')).toBeTruthy();
    });

    it('should call action onClick when clicked', () => {
      const onClick = vi.fn();
      const actions = [
        {
          id: 'test',
          label: 'Test Action',
          icon: <Check className="w-4 h-4" />,
          onClick,
        },
      ];

      render(
        <TaskContextMenu {...defaultProps} actions={actions} />
      );

      const button = screen.getByText('Test Action');
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalled();
    });

    it('should close menu after action is clicked', () => {
      const onClose = vi.fn();
      render(
        <TaskContextMenu {...defaultProps} onClose={onClose} />
      );

      const button = screen.getByText('Mark as complete');
      fireEvent.click(button);

      expect(onClose).toHaveBeenCalled();
    });

    it('should disable action when disabled prop is true', () => {
      const actions = [
        {
          id: 'test',
          label: 'Disabled Action',
          icon: <Check className="w-4 h-4" />,
          onClick: vi.fn(),
          disabled: true,
        },
      ];

      render(
        <TaskContextMenu {...defaultProps} actions={actions} />
      );

      const button = screen.getByText('Disabled Action').closest('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('should show no actions message when actions array is empty', () => {
      render(
        <TaskContextMenu {...defaultProps} actions={[]} />
      );
      expect(screen.getByText('No actions available')).toBeTruthy();
    });
  });

  describe('Position Calculation', () => {
    it('should position menu at provided coordinates', () => {
      const { container } = render(
        <TaskContextMenu {...defaultProps} position={{ x: 200, y: 300 }} />
      );

      const menu = container.querySelector('[class*="fixed"]');
      expect(menu).toHaveStyle('left: 200px');
      expect(menu).toHaveStyle('top: 300px');
    });

    it('should adjust position to avoid going off-screen horizontally', () => {
      const { container } = render(
        <TaskContextMenu
          {...defaultProps}
          position={{ x: window.innerWidth + 100, y: 100 }}
        />
      );

      const menu = container.querySelector('[class*="fixed"]');
      const style = menu?.getAttribute('style');
      expect(style).toBeTruthy();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should close menu on Escape key', () => {
      const onClose = vi.fn();
      render(
        <TaskContextMenu {...defaultProps} onClose={onClose} />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should close menu when clicking outside', () => {
      const onClose = vi.fn();
      render(
        <TaskContextMenu {...defaultProps} onClose={onClose} />
      );

      fireEvent.mouseDown(document.body);

      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('generateTaskContextActions', () => {
  const defaultProps = {
    taskId: 1,
    taskStatus: 'not_started',
    onChangeStatus: vi.fn(),
    onAddSubtask: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Actions', () => {
    it('should generate complete action for not_started task', () => {
      const actions = generateTaskContextActions(defaultProps);
      const completeAction = actions.find((a) => a.id === 'complete');

      expect(completeAction).toBeTruthy();
      expect(completeAction?.label).toContain('complete');
    });

    it('should generate uncomplete action for completed task', () => {
      const actions = generateTaskContextActions({
        ...defaultProps,
        taskStatus: 'completed',
      });
      const uncompleteAction = actions.find((a) => a.id === 'uncomplete');

      expect(uncompleteAction).toBeTruthy();
      expect(uncompleteAction?.label).toContain('incomplete');
    });
  });

  describe('Optional Actions', () => {
    it('should include priority action when onChangePriority is provided', () => {
      const onChangePriority = vi.fn();
      const actions = generateTaskContextActions({
        ...defaultProps,
        onChangePriority,
      });
      const priorityAction = actions.find((a) => a.id === 'priority');

      expect(priorityAction).toBeTruthy();
    });

    it('should include discuss action when onDiscuss is provided', () => {
      const onDiscuss = vi.fn();
      const actions = generateTaskContextActions({
        ...defaultProps,
        onDiscuss,
      });
      const discussAction = actions.find((a) => a.id === 'discuss');

      expect(discussAction).toBeTruthy();
    });

    it('should not include priority action when onChangePriority is not provided', () => {
      const actions = generateTaskContextActions(defaultProps);
      const priorityAction = actions.find((a) => a.id === 'priority');

      expect(priorityAction).toBeFalsy();
    });
  });

  describe('Delete Action', () => {
    it('should always include delete action', () => {
      const actions = generateTaskContextActions(defaultProps);
      const deleteAction = actions.find((a) => a.id === 'delete');

      expect(deleteAction).toBeTruthy();
      expect(deleteAction?.variant).toBe('destructive');
    });

    it('should call onDelete when delete action is triggered', () => {
      const onDelete = vi.fn();
      const actions = generateTaskContextActions({
        ...defaultProps,
        onDelete,
      });
      const deleteAction = actions.find((a) => a.id === 'delete');

      deleteAction?.onClick();

      expect(onDelete).toHaveBeenCalled();
    });
  });
});
