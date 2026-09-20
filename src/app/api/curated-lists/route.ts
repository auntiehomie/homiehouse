import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { getDb } from "@/lib/db";
import { hypersnapFetch } from "@/lib/hypersnap";
import { handleApiError } from "@/lib/errors";
import { verifyFarcasterSignerAuth } from "@/lib/auth";
import { createApiLogger } from "@/lib/logger";

/** Bulk-hydrate curator fids into { fid, username, display_name, pfp_url } — same
 * /v2/farcaster/user/bulk endpoint already used by /api/profile for single lookups. */
async function hydrateCurators(fids: number[]): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (fids.length === 0) return map;
  try {
    const data = await hypersnapFetch(
      `/v2/farcaster/user/bulk?fids=${fids.join(",")}`,
    );
    for (const u of data?.users ?? []) {
      if (u?.fid)
        map.set(u.fid, {
          fid: u.fid,
          username: u.username,
          display_name: u.display_name,
          pfp_url: u.pfp_url,
        });
    }
  } catch {
    // Best-effort — lists still render with just a fid if hydration fails
  }
  return map;
}

export async function GET(request: NextRequest) {
  const logger = createApiLogger("/curated-lists");
  logger.start();

  try {
    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const { success: rateLimitOk } = rateLimit(`curated-lists:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");
    const isPublicBrowse = searchParams.get("public") === "true";

    if (isPublicBrowse) {
      logger.info("Browsing public lists");
      const { rows } = await db.query(
        `SELECT cl.*, COUNT(cli.id)::int AS item_count
         FROM curated_lists cl
         LEFT JOIN curated_list_items cli ON cli.list_id = cl.id
         WHERE cl.is_public = true
         GROUP BY cl.id
         ORDER BY cl.created_at DESC
         LIMIT 50`,
      );
      const curators = await hydrateCurators([
        ...new Set(rows.map((r: any) => r.fid)),
      ]);
      const lists = rows.map((r: any) => ({
        ...r,
        curator: curators.get(r.fid) ?? { fid: r.fid },
      }));
      logger.success("Public lists fetched", { count: lists.length });
      logger.end();
      return NextResponse.json({ lists });
    }

    // Private listing: identity comes from the verified signer, never from the
    // query string, so a caller can only ever read their own lists.
    const fid = await verifyFarcasterSignerAuth(request);
    if (fidParam && Number(fidParam) !== fid) {
      return NextResponse.json(
        { error: "fid does not match authenticated user" },
        { status: 403 },
      );
    }

    logger.info("Fetching curated lists", { fid });

    const { rows } = await db.query(
      `SELECT * FROM curated_lists WHERE fid = $1 ORDER BY created_at DESC`,
      [fid],
    );

    logger.success("Lists fetched", { count: rows.length });
    logger.end();
    return NextResponse.json({ lists: rows });
  } catch (error: any) {
    logger.error("Failed to fetch curated lists", error);
    return handleApiError(error, "GET /curated-lists");
  }
}

/**
 * PATCH /api/curated-lists
 * Body: { id, isPublic } — toggle an existing list's visibility.
 * The owner fid comes from the verified signer, so the WHERE clause is a real
 * ownership check rather than one the caller supplies both sides of.
 */
export async function PATCH(request: NextRequest) {
  const logger = createApiLogger("/curated-lists PATCH");
  logger.start();

  try {
    const ownerFid = await verifyFarcasterSignerAuth(request);
    const db = getDb();
    const { id, isPublic } = await request.json();

    const listId = Number(id);
    if (!listId || isNaN(listId) || typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "id and isPublic (boolean) are required" },
        { status: 400 },
      );
    }

    const { rows } = await db.query(
      `UPDATE curated_lists SET is_public = $1, updated_at = NOW() WHERE id = $2 AND fid = $3 RETURNING *`,
      [isPublic, listId, ownerFid],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "List not found or not owned by this fid" },
        { status: 404 },
      );
    }

    logger.success("List visibility updated", { listId, isPublic });
    logger.end();
    return NextResponse.json({ list: rows[0] });
  } catch (error: any) {
    logger.error("Failed to update list visibility", error);
    return handleApiError(error, "PATCH /curated-lists");
  }
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger("/curated-lists POST");
  logger.start();

  try {
    const validatedFid = await verifyFarcasterSignerAuth(request);
    const db = getDb();
    const body = await request.json();
    const { listName, description, isPublic } = body;

    if (!listName) {
      return NextResponse.json(
        { error: "listName is required" },
        { status: 400 },
      );
    }

    logger.info("Creating list", { fid: validatedFid, listName });

    try {
      const { rows } = await db.query(
        `INSERT INTO curated_lists (fid, list_name, description, is_public)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [validatedFid, listName, description || null, isPublic || false],
      );
      logger.success("List created", { listId: rows[0]?.id });
      logger.end();
      return NextResponse.json({ list: rows[0] });
    } catch (err: any) {
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "List with this name already exists" },
          { status: 400 },
        );
      }
      logger.error("Database error creating list", err);
      return NextResponse.json(
        { error: "Failed to create list" },
        { status: 500 },
      );
    }
  } catch (error: any) {
    logger.error("Failed to create list", error);
    return handleApiError(error, "POST /curated-lists");
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger("/curated-lists DELETE");
  logger.start();

  try {
    const fid = await verifyFarcasterSignerAuth(request);
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("id");

    if (!listId) {
      return NextResponse.json(
        { error: "List ID is required" },
        { status: 400 },
      );
    }

    const parsedListId = parseInt(listId);
    if (isNaN(parsedListId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    logger.info("Deleting list", { listId: parsedListId, fid });

    // Delete the owning row first and only proceed if it matched: scoping the
    // item delete by list_id alone let any caller empty any user's list.
    const { rowCount } = await db.query(
      `DELETE FROM curated_lists WHERE id = $1 AND fid = $2`,
      [parsedListId, fid],
    );

    if (!rowCount) {
      return NextResponse.json(
        { error: "List not found or not owned by this fid" },
        { status: 404 },
      );
    }

    // Cascade delete handles items automatically, but explicit for clarity
    await db.query(`DELETE FROM curated_list_items WHERE list_id = $1`, [
      parsedListId,
    ]);

    logger.success("List deleted", { listId: parsedListId });
    logger.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete list", error);
    return handleApiError(error, "DELETE /curated-lists");
  }
}
