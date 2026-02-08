/**
 * Tests for PriorityBadge component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "./PriorityBadge";

describe("PriorityBadge", () => {
  describe("rendering", () => {
    it("should render critical priority", () => {
      render(<PriorityBadge priority="critical" />);
      expect(screen.getByText("Критический")).toBeInTheDocument();
    });

    it("should render high priority", () => {
      render(<PriorityBadge priority="high" />);
      expect(screen.getByText("Высокий")).toBeInTheDocument();
    });

    it("should render medium priority", () => {
      render(<PriorityBadge priority="medium" />);
      expect(screen.getByText("Средний")).toBeInTheDocument();
    });

    it("should render low priority", () => {
      render(<PriorityBadge priority="low" />);
      expect(screen.getByText("Низкий")).toBeInTheDocument();
    });

    it("should default to medium for null priority", () => {
      render(<PriorityBadge priority={null} />);
      expect(screen.getByText("Средний")).toBeInTheDocument();
    });

    it("should default to medium for undefined priority", () => {
      render(<PriorityBadge priority={undefined} />);
      expect(screen.getByText("Средний")).toBeInTheDocument();
    });
  });

  describe("showLabel prop", () => {
    it("should hide label when showLabel is false", () => {
      render(<PriorityBadge priority="high" showLabel={false} />);
      expect(screen.queryByText("Высокий")).not.toBeInTheDocument();
    });

    it("should show label by default", () => {
      render(<PriorityBadge priority="high" />);
      expect(screen.getByText("Высокий")).toBeInTheDocument();
    });
  });

  describe("size prop", () => {
    it("should render small size", () => {
      const { container } = render(<PriorityBadge priority="high" size="sm" />);
      expect(container.firstChild).toHaveClass("h-5");
    });

    it("should render medium size by default", () => {
      const { container } = render(<PriorityBadge priority="high" />);
      expect(container.firstChild).toHaveClass("h-6");
    });

    it("should render large size", () => {
      const { container } = render(<PriorityBadge priority="high" size="lg" />);
      expect(container.firstChild).toHaveClass("h-7");
    });
  });

  describe("className prop", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <PriorityBadge priority="high" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("color coding", () => {
    it("should have red color for critical", () => {
      const { container } = render(<PriorityBadge priority="critical" />);
      expect(container.firstChild).toHaveClass("bg-red-500/10");
    });

    it("should have orange color for high", () => {
      const { container } = render(<PriorityBadge priority="high" />);
      expect(container.firstChild).toHaveClass("bg-orange-500/10");
    });

    it("should have yellow color for medium", () => {
      const { container } = render(<PriorityBadge priority="medium" />);
      expect(container.firstChild).toHaveClass("bg-yellow-500/10");
    });

    it("should have slate color for low", () => {
      const { container } = render(<PriorityBadge priority="low" />);
      expect(container.firstChild).toHaveClass("bg-slate-500/10");
    });
  });
});
