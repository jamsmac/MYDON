/**
 * SkipLink Component - WCAG 2.1 Skip Link
 * Allows keyboard users to skip navigation and go directly to main content
 */

import { cn } from '@/lib/utils';

interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId?: string;
  /** Link text */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SkipLink({
  targetId = 'main-content',
  children = 'Перейти к основному содержимому',
  className,
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Hidden by default
        'sr-only',
        // Visible when focused
        'focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
        'focus:px-4 focus:py-2 focus:rounded-md',
        'focus:bg-amber-500 focus:text-slate-900 focus:font-medium',
        'focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900',
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </a>
  );
}

export default SkipLink;
