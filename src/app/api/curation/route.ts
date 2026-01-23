import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");
    const type = searchParams.get("type");

    if (!fid) {
      return NextResponse.json({ ok: false, error: "FID required" }, { status: 400 });
    }

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    let url = `${serverUrl}/api/curation?fid=${fid}`;
    if (type) {
      url += `&type=${type}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching curation preferences:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, preference_type, preference_value, action, priority } = body;

    if (!fid || !preference_type || !preference_value || !action) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid,
        preference_type,
        preference_value,
        action,
        priority: priority || 0,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error adding curation preference:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to add preference" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Preference ID required" },
        { status: 400 }
      );
    }

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating curation preference:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update preference" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Preference ID required" },
        { status: 400 }
      );
    }

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation?id=${id}`, {
      method: "DELETE",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting curation preference:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete preference" },
      { status: 500 }
    );
  }
}
