import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Initialize supabase client only if credentials are available
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// GET /api/curated-lists - Get user's curated lists
export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists');
  logger.start();

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    
    if (!fidParam) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }
    
    // Validate FID
    const fid = validateFid(fidParam);
    logger.info('Fetching curated lists', { fid });
    
    const { data, error } = await supabase
      .from('curated_lists')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Database error fetching lists', error);
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      );
    }
    
    logger.success('Lists fetched', { count: data?.length || 0 });
    logger.end();
    return NextResponse.json({ lists: data || [] });
  } catch (error: any) {
    logger.error('Failed to fetch curated lists', error);
    return handleApiError(error, 'GET /curated-lists');
  }
}

// POST /api/curated-lists - Create a new list
export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curated-lists POST');
  logger.start();

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { fid, listName, description, isPublic } = body;
    
    if (!fid || !listName) {
      return NextResponse.json(
        { error: 'FID and listName are required' },
        { status: 400 }
      );
    }
    
    // Validate FID
    const validatedFid = validateFid(fid);
    logger.info('Creating list', { fid: validatedFid, listName });
    
    const { data, error } = await supabase
      .from('curated_lists')
      .insert([{
        fid: validatedFid,
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
      logger.error('Database error creating list', error);
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      );
    }
    
    logger.success('List created', { listId: data?.id });
    logger.end();
    return NextResponse.json({ list: data });
  } catch (error: any) {
    logger.error('Failed to create list', error);
    return handleApiError(error, 'POST /curated-lists');
  }
}

// DELETE /api/curated-lists - Delete a list
export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/curated-lists DELETE');
  logger.start();

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');
    const fidParam = searchParams.get('fid');
    
    if (!listId || !fidParam) {
      return NextResponse.json(
        { error: 'List ID and FID are required' },
        { status: 400 }
      );
    }
    
    // Validate inputs
    const fid = validateFid(fidParam);
    const parsedListId = parseInt(listId);
    if (isNaN(parsedListId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    logger.info('Deleting list', { listId: parsedListId, fid });
    
    // First delete all items in the list
    await supabase
      .from('curated_list_items')
      .delete()
      .eq('list_id', parsedListId);
    
    // Then delete the list (with FID check for security)
    const { error } = await supabase
      .from('curated_lists')
      .delete()
      .eq('id', parsedListId)
      .eq('fid', fid);
    
    if (error) {
      logger.error('Database error deleting list', error);
      return NextResponse.json(
        { error: 'Failed to delete list' },
        { status: 500 }
      );
    }
    
    logger.success('List deleted', { listId: parsedListId });
    logger.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete list', error);
    return handleApiError(error, 'DELETE /curated-lists');
  }
}
