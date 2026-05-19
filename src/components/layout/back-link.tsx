import Link from 'next/link';

import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BackLinkProps {
  /** The URL to navigate back to */
  href: string;
  /** The visible label text displayed next to the arrow */
  label: string;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * BackLink renders an accessible navigation link with a left arrow icon,
 * used on nested pages to provide a clear path back to a parent page.
 */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
        className,
      )}
      aria-label={`Navigate back to ${label}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
