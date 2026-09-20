import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { getDb } from "@/lib/db";
import { verifyFarcasterSignerAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

/**
 * Resolve the list and confirm the authenticated caller owns it.
 * Returns the list id, or a populated NextResponse to return instead.
 */
async function requireListOwner(
  request: NextRequest,
  listId: number,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const fid = await verifyFarcasterSignerAuth(request);
  const db = getDb();
  const { rows } = await db.query(
    `SELECT fid FROM curated_lists WHERE id = $1`,
    [listId],
  );
  if (rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "List not found" }, { status: 404 }),
    };
  }
  if (Number(rows[0].fid) !== fid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not your list" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const { success: rateLimitOk } = rateLimit(
      `curated-lists-id-items:${ip}`,
      30,
      60,
    );
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const db = getDb();
    const { id } = await params;
    const listId = parseInt(id);

    // A private list's contents are readable only by its owner.
    const { rows: listRows } = await db.query(
      `SELECT fid, is_public FROM curated_lists WHERE id = $1`,
      [listId],
    );
    if (listRows.length === 0) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    if (!listRows[0].is_public) {
      const owner = await requireListOwner(request, listId);
      if (!owner.ok) return owner.response;
    }

    const { rows } = await db.query(
      `SELECT * FROM curated_list_items WHERE list_id = $1 ORDER BY created_at DESC`,
      [listId],
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("Exception in GET /api/curated-lists/[id]/items:", error);
    return handleApiError(error, "GET /curated-lists/[id]/items");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb();
    const { id } = await params;
    const listId = parseInt(id);

    const fid = await verifyFarcasterSignerAuth(request);
    const owner = await requireListOwner(request, listId);
    if (!owner.ok) return owner.response;

    const body = await request.json();
    const { castHash, castData, notes } = body;

    if (!castHash) {
      return NextResponse.json(
        { error: "castHash is required" },
        { status: 400 },
      );
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO curated_list_items
          (list_id, cast_hash, cast_author_fid, cast_text, cast_timestamp, added_by_fid, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          listId,
          castHash,
          castData?.author_fid || null,
          castData?.text || null,
          castData?.timestamp || null,
          fid,
          notes || null,
        ],
      );
      return NextResponse.json({ item: rows[0] });
    } catch (err: any) {
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "Cast already in this list" },
          { status: 400 },
        );
      }
      console.error("Error adding cast to list:", err);
      return NextResponse.json(
        { error: "Failed to add cast to list" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Exception in POST /api/curated-lists/[id]/items:", error);
    return handleApiError(error, "POST /curated-lists/[id]/items");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb();
    const { id } = await params;
    const listId = parseInt(id);

    const owner = await requireListOwner(request, listId);
    if (!owner.ok) return owner.response;

    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get("castHash");

    if (!castHash) {
      return NextResponse.json(
        { error: "castHash is required" },
        { status: 400 },
      );
    }

    await db.query(
      `DELETE FROM curated_list_items WHERE list_id = $1 AND cast_hash = $2`,
      [listId, castHash],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Exception in DELETE /api/curated-lists/[id]/items:", error);
    return handleApiError(error, "DELETE /curated-lists/[id]/items");
  }
}
