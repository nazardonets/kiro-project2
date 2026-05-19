'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

// ─── Fallback Component ─────────────────────────────────────────────────────

interface NavigationFallbackProps {
  homeHref: string;
}

/**
 * Minimal fallback navigation rendered when the NavigationErrorBoundary
 * catches an error from ResponsiveLayout. Provides a link back to the
 * role's home page so the user is never stuck without navigation.
 *
 * Validates: Requirement 5.5
 */
export function NavigationFallback({ homeHref }: NavigationFallbackProps) {
  return (
    <div role="navigation" aria-label="Fallback navigation">
      <a href={homeHref}>Return to home</a>
    </div>
  );
}

// ─── Error Boundary ─────────────────────────────────────────────────────────

interface NavigationErrorBoundaryProps {
  children: ReactNode;
  homeHref: string;
}

interface NavigationErrorBoundaryState {
  hasError: boolean;
}

/**
 * React Error Boundary that wraps the ResponsiveLayout component.
 * If the navigation shell fails to render, it catches the error and
 * displays a NavigationFallback with a link to the role's home page.
 *
 * Validates: Requirement 5.5
 */
export class NavigationErrorBoundary extends Component<
  NavigationErrorBoundaryProps,
  NavigationErrorBoundaryState
> {
  constructor(props: NavigationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): NavigationErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging/monitoring purposes
    console.error('NavigationErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <NavigationFallback homeHref={this.props.homeHref} />;
    }

    return this.props.children;
  }
}
