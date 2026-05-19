import Link from 'next/link';

/**
 * Admin 404 page.
 * Renders within the admin navigation shell (provided by layout.tsx).
 * Includes a link back to the admin home page.
 *
 * Validates: Requirement 5.4
 */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist in the admin section.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to Admin
      </Link>
    </div>
  );
}
