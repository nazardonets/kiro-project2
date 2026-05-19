import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to view cycle history.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can access cycle data.',
        },
        { status: 403 },
      );
    }

    // Retrieve cycle records ordered by start_date descending
    const { data: records, error } = await supabase
      .from('cycle_record')
      .select('*')
      .eq('primary_user_id', contextResult.data.userId)
      .order('start_date', { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve cycle history.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        records: records ?? [],
        count: records?.length ?? 0,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 },
    );
  }
}
