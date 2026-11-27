import type { Metadata } from 'next';
import ChannelDirectoryClient from '@/app/_page-clients/ChannelDirectoryClient';

export const metadata: Metadata = {
  title: 'Channels | HomieHouse',
  description: 'Find channels, add them to your list, browse their feeds, and post to them.',
};

export default function ChannelsPage() {
  return <ChannelDirectoryClient />;
}
