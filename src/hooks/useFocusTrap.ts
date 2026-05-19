'use client';

import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A hook that traps keyboard focus within a container element when active.
 * When active:
 * - Tab at the last focusable element wraps to the first
 * - Shift+Tab at the first focusable element wraps to the last
 * When deactivated:
 * - Returns focus to the trigger element (e.g., hamburger button)
 *
 * Also handles Escape key to call the onEscape callback.
 *
 * Validates: Requirements 6.5, 6.6
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  options?: {
    triggerRef?: RefObject<HTMLElement | null>;
    onEscape?: () => void;
  },
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    // Store the currently focused element so we can restore it on deactivation
    previousActiveElement.current = document.activeElement as HTMLElement;

    function getFocusableElements(): HTMLElement[] {
      if (!containerRef.current) return [];
      const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      return Array.from(elements).filter(
        (el) => el.offsetParent !== null && !el.hasAttribute('aria-hidden'),
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && options?.onEscape) {
        e.preventDefault();
        options.onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if at first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if at last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    // Focus the first focusable element in the container
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, containerRef, options]);

  // Return focus to trigger element when deactivated
  useEffect(() => {
    if (!isActive && previousActiveElement.current) {
      if (options?.triggerRef?.current) {
        options.triggerRef.current.focus();
      } else if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      previousActiveElement.current = null;
    }
  }, [isActive, options]);
}
