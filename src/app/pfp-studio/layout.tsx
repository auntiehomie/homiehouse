import type { Metadata } from 'next';

const appUrl = 'https://homiehouse.lol/pfp-studio';
const miniAppFrame = {
  version: '1',
  imageUrl: 'https://homiehouse.lol/homiehouse-icon-512.png',
  button: {
    title: 'Style my photo',
    action: {
      type: 'launch_frame',
      name: 'Homiehouse Studio',
      url: appUrl,
      splashImageUrl: 'https://homiehouse.lol/homiehouse-icon-512.png',
      splashBackgroundColor: '#1a1a1c',
    },
  },
};

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Make an original digital-campus portrait from your profile photo in Homiehouse.',
  openGraph: {
    title: 'Homiehouse Studio',
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
