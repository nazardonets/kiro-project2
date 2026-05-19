import Link from 'next/link';

export default function PartnerNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/partner"
        className="mt-6 text-sm font-medium text-primary underline hover:no-underline"
      >
        Back to Partner Home
      </Link>
    </div>
  );
}
