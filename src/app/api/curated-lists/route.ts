import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/curated-lists - Get user's curated lists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('curated_lists')
      .select('*')
      .eq('fid', parseInt(fid))
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching curated lists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ lists: data || [] });
  } catch (error) {
    console.error('Exception in GET /api/curated-lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/curated-lists - Create a new list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, listName, description, isPublic } = body;
    
    if (!fid || !listName) {
      return NextResponse.json(
        { error: 'FID and listName are required' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('curated_lists')
      .insert([{
        fid: parseInt(fid),
        list_name: listName,
        description: description || null,
        is_public: isPublic || false
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'List with this name already exists' },
          { status: 400 }
        );
      }
      console.error('Error creating list:', error);
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ list: data });
  } catch (error) {
    console.error('Exception in POST /api/curated-lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/curated-lists - Delete a list
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');
    const fid = searchParams.get('fid');
    
    if (!listId || !fid) {
      return NextResponse.json(
        { error: 'List ID and FID are required' },
        { status: 400 }
      );
    }
    
    // First delete all items in the list
    await supabase
      .from('curated_list_items')
      .delete()
      .eq('list_id', parseInt(listId));
    
    // Then delete the list (with FID check for security)
    const { error } = await supabase
      .from('curated_lists')
      .delete()
      .eq('id', parseInt(listId))
      .eq('fid', parseInt(fid));
    
    if (error) {
      console.error('Error deleting list:', error);
      return NextResponse.json(
        { error: 'Failed to delete list' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception in DELETE /api/curated-lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
