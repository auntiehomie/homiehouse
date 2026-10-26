import { Metadata } from 'next';

const miniAppFrame = {
  version: "1",
  imageUrl: "https://homiehouse.xyz/og-ask-homie.png",
  button: {
    title: "Ask Homie",
    action: {
      type: "launch_miniapp",
      name: "Ask Homie AI",
      url: "https://homiehouse.xyz/mini/ask-homie",
      splashImageUrl: "https://homiehouse.xyz/og-ask-homie.png",
      splashBackgroundColor: "#8B5CF6"
    }
  }
};

const legacyFrame = {
  ...miniAppFrame,
  button: {
    ...miniAppFrame.button,
    action: { ...miniAppFrame.button.action, type: 'launch_frame' },
  },
};

export const metadata: Metadata = {
  title: 'Ask Homie - AI Assistant',
  description: 'Your AI assistant for social conversations - analyze posts, search content, and get insights',
  openGraph: {
    title: 'Ask Homie - AI Assistant',
    description: 'Your AI assistant for social conversations',
    images: ['/og-ask-homie.png']
  },
  other: {
    'fc:miniapp': JSON.stringify(miniAppFrame),
    // Keep the legacy embed tag for clients that have not switched to
    // `fc:miniapp` yet.
    'fc:frame': JSON.stringify(legacyFrame),
  }
};

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
