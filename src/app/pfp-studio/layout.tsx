import type { Metadata } from 'next';

const appUrl = 'https://homiehouse.lol/pfp-studio';
const miniAppFrame = {
  version: '1',
  imageUrl: 'https://homiehouse.lol/icon-512.png',
  button: {
    title: 'Make a PFP',
    action: {
      type: 'launch_frame',
      name: 'Homiehouse PFP Studio',
      url: appUrl,
      splashImageUrl: 'https://homiehouse.lol/icon-512.png',
      splashBackgroundColor: '#1a1a1c',
    },
  },
};

export const metadata: Metadata = {
  title: 'PFP Studio',
  description: 'Make an original digital-campus portrait from your profile photo in Homiehouse.',
  openGraph: {
    title: 'Homiehouse PFP Studio',
    description: 'Create a new profile portrait in the Homiehouse visual world.',
    url: appUrl,
  },
  other: {
    'fc:miniapp': JSON.stringify(miniAppFrame),
  },
};

export default function PfpStudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
