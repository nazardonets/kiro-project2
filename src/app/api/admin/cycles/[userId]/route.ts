import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';

/**
 * GET /api/admin/cycles/:userId - List all cycle instances for a user.
 * Returns cycle records ordered by start_date descending (most recent first).
 */
export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and admin role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        { code: 'UNAUTHENTICATED', message: 'You must be logged in to access the admin panel.' },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Only admin users can access this resource.' },
        { status: 403 },
      );
    }

    const { userId } = params;

    // Verify the target user exists
    const { data: user, error: userError } = await supabase
      .from('user')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { code: 'USER_NOT_FOUND', message: 'User account not found' },
        { status: 404 },
      );
    }

    // Fetch cycle records ordered by start_date descending
    const { data: cycles, error: cyclesError } = await supabase
      .from('cycle_record')
      .select('*')
      .eq('primary_user_id', userId)
      .order('start_date', { ascending: false });

    if (cyclesError) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to retrieve cycle records.' },
        { status: 500 },
      );
    }

    // Fetch annotations for these cycles
    const cycleIds = (cycles ?? []).map((c: { id: string }) => c.id);
    let annotations: Record<string, unknown>[] = [];
    if (cycleIds.length > 0) {
      const { data: annotationData } = await supabase
        .from('admin_annotation')
        .select('*')
        .in('cycle_record_id', cycleIds);
      annotations = annotationData ?? [];
    }

    // Fetch overrides for these cycles
    let overrides: Record<string, unknown>[] = [];
    if (cycleIds.length > 0) {
      const { data: overrideData } = await supabase
        .from('admin_override')
        .select('*')
        .in('cycle_record_id', cycleIds);
      overrides = overrideData ?? [];
    }

    // Enrich cycles with annotations and overrides
    const enrichedCycles = (cycles ?? []).map((cycle: { id: string }) => ({
      ...cycle,
      annotations: annotations.filter(
        (a: Record<string, unknown>) => a.cycle_record_id === cycle.id,
      ),
      overrides: overrides.filter((o: Record<string, unknown>) => o.cycle_record_id === cycle.id),
    }));

    return NextResponse.json(
      {
        data: enrichedCycles,
        count: enrichedCycles.length,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
