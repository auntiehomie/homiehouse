import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

if (!neynarApiKey) {
  throw new Error('NEYNAR_API_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to publish a cast using Neynar
async function publishCast(signerUuid: string, text: string, embeds: any[] = []) {
  const url = 'https://api.neynar.com/v2/farcaster/cast';
  
  const body: any = {
    signer_uuid: signerUuid,
    text
  };

  if (embeds && embeds.length > 0) {
    body.embeds = embeds;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': neynarApiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neynar API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Endpoint to process and publish scheduled casts
export async function POST(req: NextRequest) {
  try {
    // This endpoint should be called by a cron job
    // For security, you might want to add authentication here
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    
    // Find all pending casts that should be published now
    const { data: scheduledCasts, error: fetchError } = await supabase
      .from('scheduled_casts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now.toISOString())
      .order('scheduled_time', { ascending: true });

    if (fetchError) {
      console.error('Error fetching scheduled casts:', fetchError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch scheduled casts' },
        { status: 500 }
      );
    }

    const results = [];

    // Process each scheduled cast
    for (const cast of scheduledCasts || []) {
      try {
        console.log(`Publishing scheduled cast ${cast.id} for user ${cast.user_fid}`);
        
        // Publish the cast
        const publishResult = await publishCast(
          cast.signer_uuid,
          cast.text,
          cast.embeds
        );

        // Update status to published
        const { error: updateError } = await supabase
          .from('scheduled_casts')
          .update({
            status: 'published',
            published_at: now.toISOString(),
            cast_hash: publishResult.cast?.hash || null
          })
          .eq('id', cast.id);

        if (updateError) {
          console.error(`Error updating cast ${cast.id}:`, updateError);
        }

        results.push({
          id: cast.id,
          success: true,
          cast_hash: publishResult.cast?.hash
        });
      } catch (error: any) {
        console.error(`Error publishing cast ${cast.id}:`, error);
        
        // Update status to failed with error message
        await supabase
          .from('scheduled_casts')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', cast.id);

        results.push({
          id: cast.id,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in publish-scheduled-casts:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Manual trigger for a specific scheduled cast
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fid } = body;

    if (!id || !fid) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or fid' },
        { status: 400 }
      );
    }

    // Get the scheduled cast
    const { data: cast, error: fetchError } = await supabase
      .from('scheduled_casts')
      .select('*')
      .eq('id', id)
      .eq('user_fid', fid)
      .eq('status', 'pending')
      .single();

    if (fetchError || !cast) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found or not pending' },
        { status: 404 }
      );
    }

    try {
      // Publish the cast
      const publishResult = await publishCast(
        cast.signer_uuid,
        cast.text,
        cast.embeds
      );

      // Update status to published
      await supabase
        .from('scheduled_casts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          cast_hash: publishResult.cast?.hash || null
        })
        .eq('id', id);

      return NextResponse.json({
        ok: true,
        cast_hash: publishResult.cast?.hash,
        message: 'Cast published successfully'
      });
    } catch (error: any) {
      // Update status to failed
      await supabase
        .from('scheduled_casts')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', id);

      return NextResponse.json(
        { ok: false, error: `Failed to publish cast: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in publish-scheduled-casts PUT:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
