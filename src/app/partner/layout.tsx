import { NavigationErrorBoundary } from '@/components/layout/navigation-error-boundary';
import { ResponsiveLayout, partnerNavItems } from '@/components/layout/responsive-layout';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationErrorBoundary homeHref="/partner">
      <ResponsiveLayout navItems={partnerNavItems} activeMatchStrategy="exact">
        {children}
      </ResponsiveLayout>
    </NavigationErrorBoundary>
  );
}
