import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { sql } from "@/lib/db";
import { verifyFarcasterSignerAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

// GET /api/saved-casts — returns the authenticated user's saved casts
export async function GET(req: NextRequest) {
  try {
    // Identity comes from the verified signer: a caller can only read their own
    // saved casts, whatever fid the query string asks for.
    const fid = await verifyFarcasterSignerAuth(req);

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const { success: rateLimitOk } = rateLimit(`saved-casts:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const rows = await sql`
      SELECT sc.*, cn.note, cn.id as note_id
      FROM saved_casts sc
      JOIN users u ON u.id = sc.user_id
      LEFT JOIN cast_notes cn ON cn.cast_id = sc.id
      WHERE u.fid = ${fid}
      ORDER BY sc.saved_at DESC
    `;
    return NextResponse.json({ casts: rows });
  } catch (err) {
    console.error("saved-casts GET error:", err);
    return handleApiError(err, "GET /saved-casts");
  }
}

// POST /api/saved-casts
// body: { cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast }
export async function POST(req: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const {
      cast_hash,
      cast_author_fid,
      cast_author_username,
      cast_text,
      cast_timestamp,
      embeds,
      raw_cast,
    } = body;
    if (!cast_hash)
      return NextResponse.json(
        { error: "cast_hash required" },
        { status: 400 },
      );

    // Upsert user
    await sql`
      INSERT INTO users (fid) VALUES (${fid})
      ON CONFLICT (fid) DO NOTHING
    `;
    const [user] = await sql`SELECT id FROM users WHERE fid = ${fid}`;

    // Insert saved cast
    const [saved] = await sql`
      INSERT INTO saved_casts (user_id, cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast)
      VALUES (${user.id}, ${cast_hash}, ${cast_author_fid}, ${cast_author_username}, ${cast_text}, ${cast_timestamp}, ${JSON.stringify(embeds || [])}, ${JSON.stringify(raw_cast || {})})
      ON CONFLICT (user_id, cast_hash) DO NOTHING
      RETURNING id
    `;
    return NextResponse.json({ saved: true, id: saved?.id });
  } catch (err) {
    console.error("saved-casts POST error:", err);
    return handleApiError(err, "POST /saved-casts");
  }
}

// DELETE /api/saved-casts
// body: { cast_hash }
export async function DELETE(req: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(req);
    const { cast_hash } = await req.json();
    if (!cast_hash)
      return NextResponse.json(
        { error: "cast_hash required" },
        { status: 400 },
      );
    const [user] = await sql`SELECT id FROM users WHERE fid = ${fid}`;
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    await sql`DELETE FROM saved_casts WHERE user_id = ${user.id} AND cast_hash = ${cast_hash}`;
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("saved-casts DELETE error:", err);
    return handleApiError(err, "DELETE /saved-casts");
  }
}
