# Implementation Plan: Comprehensive Navigation

## Overview

Integrate the existing `ResponsiveLayout` component into all role-based sections (dashboard, partner, admin) via Next.js layout files. Enhance the component with focus trap, close-on-outside-tap, active match strategy, and unique aria-labels. Create new layout files for dashboard and partner routes, modify the admin layout, and add error boundaries and 404 handling.

## Tasks

- [x] 1. Enhance ResponsiveLayout component
  - [x] 1.1 Add `activeMatchStrategy` prop and implement prefix/exact match logic
    - Add `ActiveMatchStrategy` type (`'prefix' | 'exact'`) to the component interface
    - Implement `isActiveByPrefix` function: for `/dashboard` root return exact match, for other items return `pathname.startsWith(href)`
    - Implement `isActiveByExact` function: return `pathname === href`
    - Replace current `pathname === item.href` checks with strategy-based logic
    - Default strategy to `'prefix'`
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 1.2 Add focus trap for hamburger menu
    - Create `useFocusTrap` hook that accepts a container ref and `isActive` boolean
    - When active, query all focusable elements inside the container
    - On Tab at last element, wrap focus to first element
    - On Shift+Tab at first element, wrap focus to last element
    - On deactivation, return focus to the hamburger menu button
    - Integrate the hook into the mobile menu section of `ResponsiveLayout`
    - _Requirements: 6.5, 6.6_

  - [x] 1.3 Add close-on-outside-tap behavior for mobile menu
    - Add a click/tap event listener on the document when the menu is open
    - If the click target is outside the mobile menu container and the hamburger button, close the menu
    - Clean up the listener when the menu closes or component unmounts
    - _Requirements: 1.6, 2.5_

  - [x] 1.4 Add unique aria-labels to navigation landmarks
    - Set desktop nav `aria-label` to `"Main navigation"` (already present, verify)
    - Set mobile slide-down menu `aria-label` to `"Mobile navigation menu"`
    - Set bottom nav `aria-label` to `"Bottom navigation"` (already present, verify)
    - Ensure all three `<nav>` elements have distinct `aria-label` values
    - _Requirements: 6.4, 6.7_

  - [x] 1.5 Add "Date Request" nav item to `primaryNavItems`
    - Add a new entry to the exported `primaryNavItems` array with `href: '/dashboard/date-request'`, `label: 'Date Request'`, and an appropriate calendar icon
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.6 Write unit tests for ResponsiveLayout enhancements
    - Test focus trap cycles through menu items on Tab/Shift+Tab
    - Test Escape key closes menu and returns focus to button
    - Test outside click closes the menu
    - Test `activeMatchStrategy='prefix'` highlights correct item
    - Test `activeMatchStrategy='exact'` highlights correct item
    - Test unique aria-labels on all nav landmarks
    - _Requirements: 6.5, 6.6, 1.6, 1.2, 2.2, 6.7_

- [x] 2. Create Dashboard layout file
  - [x] 2.1 Create `src/app/dashboard/layout.tsx`
    - Import `ResponsiveLayout` and `primaryNavItems` from `@/components/layout/responsive-layout`
    - Render `ResponsiveLayout` with `navItems={primaryNavItems}` and `activeMatchStrategy="prefix"`
    - Pass `children` as the content
    - _Requirements: 4.1, 4.5, 1.1, 1.2_

  - [x] 2.2 Write unit test for dashboard layout
    - Verify layout renders `ResponsiveLayout` with all 5 primary nav items
    - Verify children are rendered inside the main content area
    - _Requirements: 4.1, 4.5_

- [x] 3. Create Partner layout file
  - [x] 3.1 Create `src/app/partner/layout.tsx`
    - Import `ResponsiveLayout` and `partnerNavItems` from `@/components/layout/responsive-layout`
    - Render `ResponsiveLayout` with `navItems={partnerNavItems}` and `activeMatchStrategy="exact"`
    - Pass `children` as the content
    - _Requirements: 4.2, 4.5, 2.1, 2.2_

  - [x] 3.2 Write unit test for partner layout
    - Verify layout renders `ResponsiveLayout` with 2 partner nav items (Insights, Settings)
    - Verify children are rendered inside the main content area
    - _Requirements: 4.2, 4.5_

- [x] 4. Modify Admin layout to use ResponsiveLayout
  - [x] 4.1 Update `src/app/admin/layout.tsx` to wrap authorized content with ResponsiveLayout
    - Add `adminNavItems` export with Users (`/admin`) and Cycles (`/admin/cycles`) items
    - In the `authorized` state, replace the existing header/main markup with `<ResponsiveLayout navItems={adminNavItems} activeMatchStrategy="prefix">`
    - Preserve the loading and unauthorized states without navigation shell
    - _Requirements: 4.3, 3.1, 3.3_

  - [x] 4.2 Write unit test for admin layout auth gate + navigation
    - Verify loading state does NOT render navigation shell
    - Verify unauthorized state does NOT render navigation shell
    - Verify authorized state renders `ResponsiveLayout` with admin nav items
    - _Requirements: 4.3_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add error boundary and fallback navigation
  - [x] 6.1 Create `NavigationErrorBoundary` component
    - Create `src/components/layout/navigation-error-boundary.tsx`
    - Implement a React Error Boundary class component that catches errors from `ResponsiveLayout`
    - Render a `NavigationFallback` component with a link to the role's home page
    - Accept `homeHref` prop to configure the fallback link destination
    - _Requirements: 5.5_

  - [x] 6.2 Integrate error boundary into layout files
    - Wrap `ResponsiveLayout` in `NavigationErrorBoundary` in dashboard layout (`homeHref="/dashboard"`)
    - Wrap `ResponsiveLayout` in `NavigationErrorBoundary` in partner layout (`homeHref="/partner"`)
    - Wrap `ResponsiveLayout` in `NavigationErrorBoundary` in admin layout (`homeHref="/admin"`)
    - _Requirements: 5.5_

  - [x] 6.3 Write unit test for error boundary fallback
    - Verify that when `ResponsiveLayout` throws, the fallback link renders within 3 seconds
    - Verify fallback link points to the correct home page
    - _Requirements: 5.5_

- [x] 7. Add 404 pages with navigation shell
  - [x] 7.1 Create `src/app/dashboard/not-found.tsx`
    - Render a 404 message within the navigation shell (layout already wraps it)
    - Include a link back to `/dashboard`
    - _Requirements: 5.4_

  - [x] 7.2 Create `src/app/partner/not-found.tsx`
    - Render a 404 message within the navigation shell (layout already wraps it)
    - Include a link back to `/partner`
    - _Requirements: 5.4_

  - [x] 7.3 Create `src/app/admin/not-found.tsx`
    - Render a 404 message within the navigation shell (layout already wraps it)
    - Include a link back to `/admin`
    - _Requirements: 5.4_

- [x] 8. Add BackLink component for admin nested pages
  - [x] 8.1 Create `BackLink` component at `src/components/layout/back-link.tsx`
    - Accept `href` and `label` props
    - Render an accessible link with a left arrow and label text
    - Style with Tailwind for consistent appearance
    - _Requirements: 3.2_

  - [x] 8.2 Add `BackLink` to admin nested page `src/app/admin/users/[id]/cycles/page.tsx`
    - Import and render `BackLink` with `href="/admin"` and `label="Back to Users"`
    - Place it above the existing page content
    - _Requirements: 3.2_

- [x] 9. Property-based tests for navigation correctness
  - [x] 9.1 Write property test for prefix match active indicator
    - **Property 1: Prefix match active indicator selects the longest matching nav item**
    - Generate random URL pathnames under `/dashboard` and `/admin` using `fast-check`
    - Verify that exactly one nav item is marked active and it has the longest matching prefix
    - **Validates: Requirements 1.2, 3.3, 6.2**

  - [x] 9.2 Write property test for exact match active indicator
    - **Property 2: Exact match active indicator selects only the exactly matching nav item**
    - Generate random URL pathnames and partner nav item sets using `fast-check`
    - Verify that a nav item is marked active if and only if its href strictly equals the pathname
    - **Validates: Requirements 2.2, 6.2**

  - [x] 9.3 Write property test for navigation configuration minimum link count
    - **Property 3: Navigation configuration satisfies minimum link count per role section**
    - Verify `primaryNavItems` has ≥2 items all under `/dashboard`
    - Verify `partnerNavItems` has ≥2 items all under `/partner`
    - Verify `adminNavItems` has ≥1 item all under `/admin`
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `ResponsiveLayout` component is enhanced in-place rather than replaced
- Admin layout preserves its auth gate; navigation only renders after authorization
- `fast-check` and `vitest` are already available in the project

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.6", "2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.2", "6.1", "7.1", "7.2", "7.3", "8.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "8.2"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3"] }
  ]
}
```
