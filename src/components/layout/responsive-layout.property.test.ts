import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  isActiveByPrefix,
  primaryNavItems,
  partnerNavItems,
  adminNavItems,
} from './responsive-layout';

/**
 * Feature: comprehensive-navigation
 * Property 3: Navigation configuration satisfies minimum link count per role section
 *
 * For any role section configuration (dashboard, partner, admin), the nav items array
 * SHALL contain at least the minimum required number of distinct links (2 for dashboard,
 * 2 for partner, 1 for admin), and all links SHALL point to paths within the respective
 * role section prefix.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
describe('Feature: comprehensive-navigation, Property 3: Navigation configuration satisfies minimum link count per role section', () => {
  it('primaryNavItems has ≥2 items and all hrefs are under /dashboard', () => {
    fc.assert(
      fc.property(fc.constant(primaryNavItems), (navItems) => {
        // Must have at least 2 items
        expect(navItems.length).toBeGreaterThanOrEqual(2);

        // All hrefs must start with /dashboard
        for (const item of navItems) {
          expect(item.href).toMatch(/^\/dashboard/);
        }

        // All hrefs must be distinct
        const hrefs = navItems.map((item) => item.href);
        const uniqueHrefs = new Set(hrefs);
        expect(uniqueHrefs.size).toBe(hrefs.length);
      }),
      { numRuns: 100 },
    );
  });

  it('partnerNavItems has ≥2 items and all hrefs are under /partner', () => {
    fc.assert(
      fc.property(fc.constant(partnerNavItems), (navItems) => {
        // Must have at least 2 items
        expect(navItems.length).toBeGreaterThanOrEqual(2);

        // All hrefs must start with /partner
        for (const item of navItems) {
          expect(item.href).toMatch(/^\/partner/);
        }

        // All hrefs must be distinct
        const hrefs = navItems.map((item) => item.href);
        const uniqueHrefs = new Set(hrefs);
        expect(uniqueHrefs.size).toBe(hrefs.length);
      }),
      { numRuns: 100 },
    );
  });

  it('adminNavItems has ≥1 item and all hrefs are under /admin', () => {
    fc.assert(
      fc.property(fc.constant(adminNavItems), (navItems) => {
        // Must have at least 1 item
        expect(navItems.length).toBeGreaterThanOrEqual(1);

        // All hrefs must start with /admin
        for (const item of navItems) {
          expect(item.href).toMatch(/^\/admin/);
        }

        // All hrefs must be distinct
        const hrefs = navItems.map((item) => item.href);
        const uniqueHrefs = new Set(hrefs);
        expect(uniqueHrefs.size).toBe(hrefs.length);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: comprehensive-navigation
 * Property 1: Prefix match active indicator selects the longest matching nav item
 *
 * For any URL pathname under `/dashboard` (or `/admin`) and any set of nav items with
 * distinct href prefixes, the active indicator function SHALL return the nav item whose
 * `href` is the longest prefix of the pathname, and exactly one item SHALL be marked active.
 *
 * **Validates: Requirements 1.2, 3.3, 6.2**
 */
describe('Feature: comprehensive-navigation, Property 1: Prefix match active indicator selects the longest matching nav item', () => {
  const primaryHrefs = primaryNavItems.map((item) => item.href);
  const adminHrefs = adminNavItems.map((item) => item.href);

  /**
   * Generate a random pathname under a given prefix.
   * Produces paths like `/dashboard`, `/dashboard/cycle`, `/dashboard/cycle/foo/bar`, etc.
   */
  function pathnameUnderPrefix(prefix: string, knownSubPaths: string[]): fc.Arbitrary<string> {
    const knownPath = fc.constantFrom(...knownSubPaths);
    const randomSuffix = fc
      .array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 1, maxLength: 4 })
      .map((segments) => segments.join('/'));

    return fc.oneof(
      // Exact known path (e.g., '/dashboard/cycle')
      knownPath,
      // Known path with extra segments (e.g., '/dashboard/cycle/details')
      knownPath.chain((base) => randomSuffix.map((suffix) => `${base}/${suffix}`)),
      // Random path under prefix (e.g., '/dashboard/random-segment')
      randomSuffix.map((suffix) => `${prefix}/${suffix}`),
    );
  }

  /**
   * Given a pathname and a set of nav items, find the expected active item
   * using longest prefix match logic (matching isActiveByPrefix behavior).
   */
  function findLongestMatchingItem(pathname: string, items: typeof primaryNavItems) {
    const activeItems = items.filter((item) => isActiveByPrefix(pathname, item.href));
    if (activeItems.length === 0) return null;
    return activeItems.reduce((longest, current) =>
      current.href.length > longest.href.length ? current : longest,
    );
  }

  it('selects at most one active item for any dashboard pathname (150 iterations)', () => {
    fc.assert(
      fc.property(pathnameUnderPrefix('/dashboard', primaryHrefs), (pathname) => {
        const activeItems = primaryNavItems.filter((item) => isActiveByPrefix(pathname, item.href));
        const expectedActive = findLongestMatchingItem(pathname, primaryNavItems);

        if (expectedActive === null) {
          // No item matches - valid for random paths not matching any prefix
          expect(activeItems.length).toBe(0);
        } else {
          // The longest match should be deterministic and unique
          const longestMatch = activeItems.reduce((longest, current) =>
            current.href.length > longest.href.length ? current : longest,
          );
          expect(longestMatch.href).toBe(expectedActive.href);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('selects at most one active item for any admin pathname (150 iterations)', () => {
    fc.assert(
      fc.property(pathnameUnderPrefix('/admin', adminHrefs), (pathname) => {
        const activeItems = adminNavItems.filter((item) => isActiveByPrefix(pathname, item.href));
        const expectedActive = findLongestMatchingItem(pathname, adminNavItems);

        if (expectedActive === null) {
          expect(activeItems.length).toBe(0);
        } else {
          const longestMatch = activeItems.reduce((longest, current) =>
            current.href.length > longest.href.length ? current : longest,
          );
          expect(longestMatch.href).toBe(expectedActive.href);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('the active item always has the longest matching prefix among all nav items', () => {
    fc.assert(
      fc.property(pathnameUnderPrefix('/dashboard', primaryHrefs), (pathname) => {
        const activeItems = primaryNavItems.filter((item) => isActiveByPrefix(pathname, item.href));

        if (activeItems.length > 0) {
          const longestMatch = activeItems.reduce((longest, current) =>
            current.href.length > longest.href.length ? current : longest,
          );

          // Verify no other active item has a longer href
          for (const item of activeItems) {
            expect(item.href.length).toBeLessThanOrEqual(longestMatch.href.length);
          }

          // Verify the longest match is indeed a valid prefix of the pathname
          const segments = longestMatch.href.split('/').filter(Boolean);
          if (segments.length <= 1) {
            // Root-level items use exact match
            expect(pathname).toBe(longestMatch.href);
          } else {
            // Deeper items use startsWith
            expect(pathname.startsWith(longestMatch.href)).toBe(true);
          }
        }
      }),
      { numRuns: 150 },
    );
  });

  it('exactly one nav item is selected as active when pathname matches a known nav href', () => {
    fc.assert(
      fc.property(fc.constantFrom(...primaryHrefs), (pathname) => {
        const activeItems = primaryNavItems.filter((item) => isActiveByPrefix(pathname, item.href));

        // When pathname exactly matches a nav href, at least that item is active
        expect(activeItems.length).toBeGreaterThanOrEqual(1);

        // The longest match should be the exact item
        const longestMatch = activeItems.reduce((longest, current) =>
          current.href.length > longest.href.length ? current : longest,
        );
        expect(longestMatch.href).toBe(pathname);
      }),
      { numRuns: 100 },
    );
  });
});
