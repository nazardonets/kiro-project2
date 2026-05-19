import { NavigationErrorBoundary } from '@/components/layout/navigation-error-boundary';
import { ResponsiveLayout, primaryNavItems } from '@/components/layout/responsive-layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationErrorBoundary homeHref="/dashboard">
      <ResponsiveLayout navItems={primaryNavItems} activeMatchStrategy="prefix">
        {children}
      </ResponsiveLayout>
    </NavigationErrorBoundary>
  );
}
