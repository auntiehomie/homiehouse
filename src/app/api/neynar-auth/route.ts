import { NextRequest, NextResponse } from "next/server";

// In-memory store for auth sessions (use Redis or database in production)
const authSessions = new Map<string, {
  status: 'pending' | 'completed';
  profile?: any;
  signerUuid?: string;
  createdAt: number;
}>();

// Clean up old sessions on each request (serverless compatible)
function cleanupSessions() {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  for (const [token, session] of authSessions.entries()) {
    if (session.createdAt < fiveMinutesAgo) {
      authSessions.delete(token);
    }
  }
}

export async function POST() {
  cleanupSessions();
  try {
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    // Create a managed signer with Neynar
    const signerRes = await fetch("https://api.neynar.com/v2/farcaster/signer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({}),
    });

    if (!signerRes.ok) {
      const errorText = await signerRes.text();
      console.error("[Neynar Auth] Failed to create signer:", errorText);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to create signer: ${signerRes.status}` 
      }, { status: 500 });
    }

    const signerData = await signerRes.json();
    
    if (!signerData.signer_uuid || !signerData.signer_approval_url) {
      console.error("[Neynar Auth] Invalid signer response:", signerData);
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid signer response from Neynar" 
      }, { status: 500 });
    }

    // Generate a session token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store session
    authSessions.set(token, {
      status: 'pending',
      signerUuid: signerData.signer_uuid,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      token,
      signerUrl: signerData.signer_approval_url,
      signerUuid: signerData.signer_uuid,
    });
  } catch (error) {
    console.error("[Neynar Auth] Error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  cleanupSessions();
  
  try {
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const session = authSessions.get(token);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid or expired token" }, { status: 404 });
    }

    // If already completed, return cached result
    if (session.status === 'completed' && session.profile) {
      return NextResponse.json({
        ok: true,
        profile: session.profile,
        signerUuid: session.signerUuid,
      });
    }

    // Check signer status
    const signerRes = await fetch(
      `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${session.signerUuid}`,
      {
        headers: {
          "api_key": NEYNAR_API_KEY,
        },
      }
    );

    if (!signerRes.ok) {
      console.error("[Neynar Auth] Failed to check signer:", signerRes.status);
      return NextResponse.json({ ok: false, pending: true });
    }

    const signerData = await signerRes.json();
    
    // Check if signer is approved
    if (signerData.status === "approved" && signerData.fid) {
      // Fetch user profile
      const userRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${signerData.fid}`,
        {
          headers: {
            "api_key": NEYNAR_API_KEY,
          },
        }
      );

      if (userRes.ok) {
        const userData = await userRes.json();
        const user = userData.users?.[0];
        
        if (user) {
          const profile = {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            avatar: user.pfp_url,
          };

          // Update session as completed
          session.status = 'completed';
          session.profile = profile;
          authSessions.set(token, session);

          return NextResponse.json({
            ok: true,
            profile,
            signerUuid: session.signerUuid,
          });
        }
      }
    }

    // Still pending
    return NextResponse.json({ ok: false, pending: true });
  } catch (error) {
    console.error("[Neynar Auth] Error checking status:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
