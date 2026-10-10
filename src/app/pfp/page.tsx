import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { PfpStudio } from './PfpStudio';

export const metadata: Metadata = {
  title: 'Homiefy your profile | Homiehouse',
  description: 'Create an original Homiehouse digital-campus profile portrait.',
};

export default function PfpPage() {
  return <AppShell><PfpStudio /></AppShell>;
}
