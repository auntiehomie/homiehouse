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
  // 4. Enter your domain: 1481393129444737075.xyz
  // 5. Copy the generated manifest and replace this placeholder
  
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjMxMDMsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg0ODkzOUVCMWU3RGJlNzU5NjRCM0IyMDhlODY2OGEzRjE5NjVhYjY5In0",
      payload: "eyJkb21haW4iOiJob21pZWhvdXNlLnh5eiJ9",
      signature: "AYcsa3KM6qU67jduq7PF7d08tioURwxvJsS7n1LbXbEuWhmG4y3HLGxYLMpvTFl0IIVUPA/95iSqeD+s50m0bhw="
    },
    frame: {
      version: "1",
      name: "HomieHouse",
      iconUrl: "https://homiehouse.lol/icon-512.png",
      homeUrl: "https://homiehouse.lol/mini/ask-homie",
      imageUrl: "https://homiehouse.lol/og-image.png",
      buttonTitle: "Open HomieHouse",
      splashImageUrl: "https://homiehouse.lol/og-image.png",
      splashBackgroundColor: "#1a1a1c"
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
