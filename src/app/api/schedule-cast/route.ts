import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { neynarFetch } from '@/lib/neynar';
import { rateLimit } from '@/lib/ratelimit';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limiting (10 casts per hour per IP)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`schedule-cast:${ip}`, 10, 3600);
    
    if (!rateLimitOk) {
      return NextResponse.json(
        { ok: false, error: 'Rate limited. Try again later.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseClient();
    const body = await req.json();
    const { text, signerUuid, embeds = [], scheduled_time, channelKey } = body;

    // Validation
    if (!text || !signerUuid || !scheduled_time) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SECURITY: Verify signer UUID and get authenticated FID
    let signerData;
    try {
      const signerResponse = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerResponse || !signerResponse.fid) {
        return NextResponse.json(
          { ok: false, error: 'Invalid signer' },
          { status: 401 }
        );
      }
      signerData = signerResponse;
    } catch (error) {
      console.error('Failed to verify signer:', error);
      return NextResponse.json(
        { ok: false, error: 'Unable to verify signer' },
        { status: 401 }
      );
    }

    // Use verified FID from signer, not client input
    const fid = signerData.fid;

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
    const insertData: any = {
      user_fid: fid,
      signer_uuid: signerUuid,
      text,
      embeds: embeds,
      scheduled_time: scheduledDate.toISOString(),
      status: 'pending'
    };

    if (channelKey) {
      insertData.channel_id = channelKey;
    }

    const { data, error } = await supabase
      .from('scheduled_casts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[DB Error] schedule-cast insert failed', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details
      });
      return NextResponse.json(
        { ok: false, error: 'Failed to schedule cast' },
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
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(req.url);
    const signerUuid = searchParams.get('signerUuid');

    if (!signerUuid) {
      return NextResponse.json(
        { ok: false, error: 'Missing signerUuid parameter' },
        { status: 400 }
      );
    }

    // Verify signer and derive FID from it (prevents FID spoofing)
    let verifiedFid: number;
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) {
        return NextResponse.json({ ok: false, error: 'Invalid signer' }, { status: 401 });
      }
      verifiedFid = signerData.fid;
    } catch {
      return NextResponse.json({ ok: false, error: 'Unable to verify signer' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('scheduled_casts')
      .select('*')
      .eq('user_fid', verifiedFid)
      .in('status', ['pending', 'failed'])
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('[DB Error] schedule-cast fetch failed', {
        code: error.code,
        message: error.message,
        fid: verifiedFid
      });
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
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const signerUuid = searchParams.get('signerUuid');

    if (!id || !signerUuid) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or signerUuid parameter' },
        { status: 400 }
      );
    }

    // Verify signer and derive FID (prevents FID spoofing)
    let verifiedFid: number;
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) {
        return NextResponse.json({ ok: false, error: 'Invalid signer' }, { status: 401 });
      }
      verifiedFid = signerData.fid;
    } catch {
      return NextResponse.json({ ok: false, error: 'Unable to verify signer' }, { status: 401 });
    }

    // Update status to cancelled (only if pending or failed)
    const { data, error } = await supabase
      .from('scheduled_casts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_fid', verifiedFid)
      .in('status', ['pending', 'failed'])
      .select()
      .single();

    if (error) {
      console.error('[DB Error] schedule-cast delete failed', {
        code: error.code,
        message: error.message,
        id: id,
        fid: fid
      });
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
