import { NextRequest, NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const HOMIEHOUSE_FID = 1987078;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    // Always include @homiehouse if query matches
    const queryLower = query.toLowerCase();
    const includeHomie = 'homiehouse'.includes(queryLower) || queryLower.includes('homie');
    
    let users: any[] = [];

    // If searching for homiehouse, fetch it directly first
    if (includeHomie) {
      try {
        const homieResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${HOMIEHOUSE_FID}`,
          {
            headers: {
              'accept': 'application/json',
              'api_key': NEYNAR_API_KEY,
            },
          }
        );
        
        if (homieResponse.ok) {
          const homieData = await homieResponse.json();
          if (homieData.users && homieData.users.length > 0) {
            users.push(homieData.users[0]);
          }
        }
      } catch (e) {
        console.error('Error fetching homiehouse user:', e);
      }
    }

    // Search users via Neynar API
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(query)}&limit=5`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const searchResults = data.result?.users || [];
      
      // Add search results, avoiding duplicates
      searchResults.forEach((user: any) => {
        if (!users.find(u => u.fid === user.fid)) {
          users.push(user);
        }
      });
    }

    // Limit to 5 results
    return NextResponse.json({ users: users.slice(0, 5) });

  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ users: [] });
  }
}
