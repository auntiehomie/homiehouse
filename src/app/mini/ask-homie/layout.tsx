import { Metadata } from 'next';

const miniAppFrame = {
  version: "1",
  imageUrl: "https://homiehouse.xyz/og-ask-homie.png",
  button: {
    title: "Ask Homie",
    action: {
      type: "launch_frame",
      name: "Ask Homie AI",
      url: "https://homiehouse.xyz/mini/ask-homie",
      splashImageUrl: "https://homiehouse.xyz/og-ask-homie.png",
      splashBackgroundColor: "#8B5CF6"
    }
  }
};

export const metadata: Metadata = {
  title: 'Ask Homie - AI Assistant',
  description: 'Your AI assistant for Farcaster - analyze casts, search content, and get insights',
  openGraph: {
    title: 'Ask Homie - AI Assistant',
    description: 'Your AI assistant for Farcaster',
    images: ['/og-ask-homie.png']
  },
  other: {
    'fc:miniapp': JSON.stringify(miniAppFrame)
  }
};

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
