import { NextResponse } from 'next/server';

// This manifest needs to be signed with your Farcaster account
// Visit https://farcaster.xyz/~/settings/developer-tools and use the "Create Manifest" tool
// to generate a properly signed manifest for your domain

export async function GET() {
  // TODO: Replace with your actual signed manifest
  // You need to:
  // 1. Enable Developer Mode in Farcaster
  // 2. Go to https://farcaster.xyz/~/settings/developer-tools
  // 3. Use "Create Manifest" tool
  // 4. Enter your domain: homiehouse.xyz
  // 5. Copy the generated manifest and replace this placeholder
  
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjMxMDMsInR5cGUiOiJjdXN0b2R5IiwibmV0d29yayI6Im1haW5uZXQiLCJrZXkiOiIweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAifQ",
      payload: "eyJkb21haW4iOiJob21pZWhvdXNlLnh5eiJ9",
      signature: "AYcsa3KM6qU67jduq7PF7d08tiowTE9STE9URVNUTlVNQkVSIiwiT0FEIiwiTE9BRCIsIkxPQUQiXX0"
    },
    frame: {
      version: "1",
      name: "Ask Homie",
      iconUrl: "https://homiehouse.xyz/icon-512.png",
      homeUrl: "https://homiehouse.xyz/mini/ask-homie",
      imageUrl: "https://homiehouse.xyz/og-ask-homie.png",
      buttonTitle: "Ask Homie",
      splashImageUrl: "https://homiehouse.xyz/og-ask-homie.png",
      splashBackgroundColor: "#8B5CF6"
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
