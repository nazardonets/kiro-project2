# Requirements Document

## Introduction

This feature integrates the existing `ResponsiveLayout` component into all application pages so that every user type (Primary_User, Partner_User, Admin_User) has persistent, role-appropriate navigation. The goal is to eliminate dead-ends — every page must provide clear paths to all other relevant pages for the current user's role. Auth and onboarding pages are excluded from persistent navigation since they serve transitional flows.

## Glossary

- **Navigation_Shell**: The persistent layout wrapper (based on `ResponsiveLayout`) that provides header navigation, mobile hamburger menu, and mobile bottom navigation bar to all pages within a role's section.
- **Primary_User**: A user with the primary role who accesses the `/dashboard` section of the application.
- **Partner_User**: A user with the partner role who accesses the `/partner` section of the application.
- **Admin_User**: A user with the admin role who accesses the `/admin` section of the application.
- **Dead_End**: A page state where the user has no visible navigation element to reach other pages within their role's section.
- **Active_Indicator**: A visual treatment applied to the navigation item corresponding to the currently viewed page.
- **Nav_Item**: A single clickable element within the Navigation_Shell that links to a page.
- **Bottom_Nav**: A fixed navigation bar displayed at the bottom of the viewport on mobile devices (below 768px breakpoint).
- **Hamburger_Menu**: A collapsible menu triggered by a button in the mobile header, revealing all Nav_Items.

## Requirements

### Requirement 1: Primary_User Dashboard Navigation Shell

**User Story:** As a Primary_User, I want persistent navigation on all dashboard pages, so that I can move between Dashboard, Cycle, Sharing, Customize, and Date Request pages without typing URLs.

#### Acceptance Criteria

1. WHEN a Primary_User navigates to any page under `/dashboard`, THE Navigation_Shell SHALL render with Nav_Items in the following order: Dashboard, Cycle, Sharing, Customize, and Date Request.
2. WHILE a Primary_User is viewing a page under `/dashboard`, THE Navigation_Shell SHALL display an Active_Indicator on the Nav_Item whose route is the longest prefix match of the current URL path.
3. WHILE the viewport width is 768px or above, THE Navigation_Shell SHALL render a desktop top navigation bar with all five Nav_Items visible simultaneously.
4. WHILE the viewport width is below 768px, THE Navigation_Shell SHALL render a Bottom_Nav containing all five Nav_Items and a Hamburger_Menu button in the mobile header.
5. WHEN the Primary_User activates the Hamburger_Menu button, THE Navigation_Shell SHALL expand the menu to reveal all Nav_Items.
6. WHEN the Primary_User activates the Hamburger_Menu button while the menu is open or taps outside the menu area, THE Navigation_Shell SHALL collapse the Hamburger_Menu.

### Requirement 2: Partner_User Navigation Shell

**User Story:** As a Partner_User, I want persistent navigation on all partner pages, so that I can move between Insights and Settings pages without typing URLs.

#### Acceptance Criteria

1. WHEN a Partner_User navigates to any page under `/partner`, THE Navigation_Shell SHALL render with a Nav_Item labeled "Insights" linking to `/partner` and a Nav_Item labeled "Settings" linking to `/partner/settings`.
2. WHILE a Partner_User is viewing a page under `/partner`, THE Navigation_Shell SHALL display an Active_Indicator on the Nav_Item whose `href` exactly matches the current page pathname.
3. THE Navigation_Shell SHALL render a desktop top navigation bar with all Nav_Items visible at viewport widths of 768px and above.
4. THE Navigation_Shell SHALL render a Bottom_Nav with all Nav_Items at viewport widths below 768px.
5. WHEN a Partner_User activates the Hamburger_Menu button in the mobile header, THE Navigation_Shell SHALL reveal a panel containing all Nav_Items; the panel SHALL close when the user navigates to a page or when the viewport width is 768px or above.

### Requirement 3: Admin_User Navigation Enhancement

**User Story:** As an Admin_User, I want consistent navigation across all admin pages including deep-linked pages, so that I can always return to the main admin views without using the browser back button.

#### Acceptance Criteria

1. WHEN an Admin_User navigates to any page under `/admin`, THE Navigation_Shell SHALL render with Nav_Items for Users (linking to `/admin`) and Cycles.
2. WHEN an Admin_User is viewing a nested page such as `/admin/users/[id]/cycles`, THE Navigation_Shell SHALL display a breadcrumb or back link to the parent Users list page at `/admin`.
3. WHILE an Admin_User is viewing a page under `/admin`, THE Navigation_Shell SHALL display an Active_Indicator on the Nav_Item corresponding to the current section.

### Requirement 4: Layout Integration via Next.js Route Groups

**User Story:** As a developer, I want the Navigation_Shell integrated through Next.js layout files, so that navigation is rendered consistently without modifying individual page components.

#### Acceptance Criteria

1. THE Application SHALL provide a `layout.tsx` file in the `/dashboard` route that renders the Navigation_Shell with `primaryNavItems` around all child page content.
2. THE Application SHALL provide a `layout.tsx` file in the `/partner` route that renders the Navigation_Shell with `partnerNavItems` around all child page content.
3. THE Application SHALL preserve the existing admin `layout.tsx` authentication gate such that the Navigation_Shell with admin Nav_Items renders only after the user is verified as an Admin_User, and unauthorized or loading states do not display the Navigation_Shell.
4. THE Application SHALL NOT render the Navigation_Shell on auth pages (`/auth/*`) or the onboarding page (`/onboarding`).
5. WHEN a child page is rendered within a layout that includes the Navigation_Shell, THE Application SHALL render the child page content within the main content area of the Navigation_Shell without requiring the child page component to import or reference the Navigation_Shell directly.

### Requirement 5: No Dead-End Pages

**User Story:** As any user, I want every page I visit to have visible navigation, so that I am never stuck without a way to reach other parts of the application.

#### Acceptance Criteria

1. WHILE a user is viewing any page under `/dashboard`, THE Navigation_Shell SHALL be visible in the viewport and contain Nav_Items linking to at least 2 distinct pages within the `/dashboard` section.
2. WHILE a user is viewing any page under `/partner`, THE Navigation_Shell SHALL be visible in the viewport and contain Nav_Items linking to at least 2 distinct pages within the `/partner` section.
3. WHILE a user is viewing any page under `/admin`, THE Navigation_Shell SHALL be visible in the viewport and contain Nav_Items linking to at least 1 distinct page within the `/admin` section.
4. IF a user navigates to a URL path that does not match any defined route within their role section (`/dashboard`, `/partner`, or `/admin`), THEN THE Application SHALL display a 404 page that includes the Navigation_Shell with the role's standard Nav_Items and a Nav_Item linking to the role's home page (`/dashboard` for Primary_User, `/partner` for Partner_User, `/admin` for Admin_User).
5. IF the Navigation_Shell fails to render on any page within a role section, THEN THE Application SHALL display a fallback text link to the role's home page (`/dashboard`, `/partner`, or `/admin`) within 3 seconds of page load.

### Requirement 6: Accessibility Compliance

**User Story:** As a user relying on assistive technology, I want the navigation to be fully accessible, so that I can navigate the application using a keyboard or screen reader.

#### Acceptance Criteria

1. THE Navigation_Shell SHALL provide a skip-to-content link as the first focusable element on each page that moves keyboard focus to the main content area, bypassing all navigation elements.
2. THE Navigation_Shell SHALL use `aria-current="page"` on the Nav_Item corresponding to the active page.
3. THE Hamburger_Menu button SHALL set `aria-expanded="true"` when the menu is open and `aria-expanded="false"` when the menu is closed.
4. THE Bottom_Nav SHALL use a `<nav>` element with an `aria-label` attribute that distinguishes it from other navigation landmarks on the page.
5. WHILE the Hamburger_Menu is open, THE Navigation_Shell SHALL trap focus within the menu so that pressing Tab or Shift+Tab cycles only through focusable elements inside the menu until the user closes it or activates a Nav_Item.
6. WHEN the user presses the Escape key while the Hamburger_Menu is open, THE Navigation_Shell SHALL close the Hamburger_Menu and return focus to the Hamburger_Menu button.
7. THE Navigation_Shell SHALL render all navigation landmarks (desktop top navigation and Bottom_Nav) using `<nav>` elements each with a unique `aria-label` attribute.
8. THE Navigation_Shell SHALL display a visible focus indicator on all interactive navigation elements when they receive keyboard focus.

### Requirement 7: Date Request Page Navigation

**User Story:** As a Primary_User, I want the Date Request page to be accessible from the navigation, so that I can easily find and use the date request feature.

#### Acceptance Criteria

1. THE Navigation_Shell for Primary_User pages SHALL include a Nav_Item labeled "Date Request" linking to `/dashboard/date-request`.
2. WHEN a Primary_User is viewing the Date Request page at `/dashboard/date-request`, THE Navigation_Shell SHALL display an Active_Indicator on the Date Request Nav_Item.
3. WHEN a Primary_User activates the Date Request Nav_Item, THE Navigation_Shell SHALL navigate the user to `/dashboard/date-request` within 1 second without a full page reload.
