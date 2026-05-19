'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>Welcome to Your Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To get started, input your cycle start date. This will allow us to calculate your
            current phase and provide personalized insights.
          </p>
          <Button asChild>
            <Link href="/dashboard/cycle">Input Cycle Start Date</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
