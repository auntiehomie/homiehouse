import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/curated-lists/[id]/items - Get items in a list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('curated_list_items')
      .select('*')
      .eq('list_id', parseInt(id))
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching list items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch list items' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Exception in GET /api/curated-lists/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/curated-lists/[id]/items - Add item to list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { castHash, addedByFid, castData, notes } = body;
    
    if (!castHash || !addedByFid) {
      return NextResponse.json(
        { error: 'castHash and addedByFid are required' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('curated_list_items')
      .insert([{
        list_id: parseInt(id),
        cast_hash: castHash,
        cast_author_fid: castData?.author_fid,
        cast_text: castData?.text,
        cast_timestamp: castData?.timestamp,
        added_by_fid: parseInt(addedByFid),
        notes: notes || null
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Cast already in this list' },
          { status: 400 }
        );
      }
      console.error('Error adding cast to list:', error);
      return NextResponse.json(
        { error: 'Failed to add cast to list' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('Exception in POST /api/curated-lists/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/curated-lists/[id]/items - Remove item from list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get('castHash');
    
    if (!castHash) {
      return NextResponse.json(
        { error: 'castHash is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('curated_list_items')
      .delete()
      .eq('list_id', parseInt(id))
      .eq('cast_hash', castHash);
    
    if (error) {
      console.error('Error removing cast from list:', error);
      return NextResponse.json(
        { error: 'Failed to remove cast from list' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception in DELETE /api/curated-lists/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
