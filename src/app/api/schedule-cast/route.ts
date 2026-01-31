import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, signerUuid, fid, embeds = [], scheduled_time } = body;

    // Validation
    if (!text || !signerUuid || !fid || !scheduled_time) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: text, signerUuid, fid, scheduled_time' },
        { status: 400 }
      );
    }

    // Verify scheduled time is in the future
    const scheduledDate = new Date(scheduled_time);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Save scheduled cast to database
    const { data, error } = await supabase
      .from('scheduled_casts')
      .insert({
        user_fid: fid,
        signer_uuid: signerUuid,
        text,
        embeds: embeds,
        scheduled_time: scheduledDate.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving scheduled cast:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to schedule cast', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      scheduled_cast: data,
      message: `Cast scheduled for ${scheduledDate.toLocaleString()}`
    });
  } catch (error: any) {
    console.error('Error in schedule-cast API:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get user's scheduled casts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { ok: false, error: 'Missing fid parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('scheduled_casts')
      .select('*')
      .eq('user_fid', parseInt(fid))
      .in('status', ['pending', 'failed'])
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled casts:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch scheduled casts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      scheduled_casts: data
    });
  } catch (error: any) {
    console.error('Error in schedule-cast GET:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete/cancel a scheduled cast
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fid = searchParams.get('fid');

    if (!id || !fid) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or fid parameter' },
        { status: 400 }
      );
    }

    // Update status to cancelled (only if pending or failed)
    const { data, error } = await supabase
      .from('scheduled_casts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_fid', parseInt(fid))
      .in('status', ['pending', 'failed'])
      .select()
      .single();

    if (error) {
      console.error('Error cancelling scheduled cast:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to cancel scheduled cast' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found or already published' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Scheduled cast cancelled'
    });
  } catch (error: any) {
    console.error('Error in schedule-cast DELETE:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
