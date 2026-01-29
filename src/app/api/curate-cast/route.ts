import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * POST /api/curate-cast
 * Add a cast to a curated list (creates list if it doesn't exist)
 */
export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curate-cast');
  logger.start();

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { fid, listName, castHash, castData, notes } = body;
    
    if (!fid || !listName || !castHash) {
      return NextResponse.json(
        { error: 'FID, listName, and castHash are required' },
        { status: 400 }
      );
    }
    
    const validatedFid = validateFid(fid);
    logger.info('Curating cast', { fid: validatedFid, listName, castHash });
    
    // Step 1: Find or create the list
    let listId: number;
    
    // First try to find existing list
    const { data: existingList } = await supabase
      .from('curated_lists')
      .select('id')
      .eq('fid', validatedFid)
      .eq('list_name', listName)
      .single();
    
    if (existingList) {
      listId = existingList.id;
      logger.info('Found existing list', { listId });
    } else {
      // Create new list
      const { data: newList, error: createError } = await supabase
        .from('curated_lists')
        .insert([{
          fid: validatedFid,
          list_name: listName,
          description: `Curated collection: ${listName}`,
          is_public: false
        }])
        .select('id')
        .single();
      
      if (createError) {
        logger.error('Failed to create list', createError);
        return NextResponse.json(
          { error: 'Failed to create list' },
          { status: 500 }
        );
      }
      
      listId = newList.id;
      logger.info('Created new list', { listId });
    }
    
    // Step 2: Check if cast is already in list
    const { data: existingItem } = await supabase
      .from('curated_list_items')
      .select('id')
      .eq('list_id', listId)
      .eq('cast_hash', castHash)
      .single();
    
    if (existingItem) {
      logger.info('Cast already in list', { castHash, listId });
      return NextResponse.json({
        success: true,
        message: 'Cast already in list',
        listId,
        listName,
        alreadyAdded: true
      });
    }
    
    // Step 3: Add cast to list
    const { data: newItem, error: addError } = await supabase
      .from('curated_list_items')
      .insert([{
        list_id: listId,
        cast_hash: castHash,
        cast_author_fid: castData?.authorFid || castData?.author_fid,
        cast_text: castData?.text,
        cast_timestamp: castData?.timestamp,
        added_by_fid: validatedFid,
        notes: notes || null
      }])
      .select()
      .single();
    
    if (addError) {
      logger.error('Failed to add cast to list', addError);
      return NextResponse.json(
        { error: 'Failed to add cast to list' },
        { status: 500 }
      );
    }
    
    logger.success('Cast added to list', { listId, castHash });
    logger.end();
    
    return NextResponse.json({
      success: true,
      message: `Added to "${listName}"`,
      listId,
      listName,
      item: newItem,
      alreadyAdded: false
    });
  } catch (error: any) {
    logger.error('Failed to curate cast', error);
    return handleApiError(error, 'POST /curate-cast');
  }
}
