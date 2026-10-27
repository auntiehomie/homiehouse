import type { Metadata } from 'next';
import CourseCatalog, { type CourseCatalogItem } from '@/components/learning/CourseCatalog';
import { CURATED_CURRICULUM, CURATED_MODULES } from '@/lib/curated-curriculum';
import { PREMIUM_TRACKS } from '@/lib/premium-curriculum';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'Course Catalog',
  description: 'Choose a standalone course or an interactive learning path across crypto safety, network states, and premium topics.',
  alternates: { canonical: '/learn/library' },
};

export default function LearningLibraryPage() {
  const courses = CURATED_MODULES.map((module): CourseCatalogItem => ({
    id: module.id,
    title: module.title,
    description: module.description,
    estimatedMinutes: module.estimatedMinutes,
    difficulty: module.difficulty,
    tags: module.tags,
    section: module.tags.includes('network-states') ? 'network' : 'safety',
  })).concat(PREMIUM_TRACKS.flatMap(track => track.modules.map((module): CourseCatalogItem => ({
    id: module.id,
    title: module.title,
    description: module.description,
    estimatedMinutes: module.estimatedMinutes,
    difficulty: module.difficulty,
    tags: module.tags,
    section: 'premium',
    href: `/learn/premium/${module.id}`,
  }))));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'HomieHouse Course Catalog',
    url: `${BASE_URL}/learn/library`,
    description: metadata.description,
    hasPart: [
      ...CURATED_CURRICULUM.map(({ module }) => ({
      '@type': 'LearningResource',
      name: module.title,
      url: `${BASE_URL}/learn/library/${module.id}`,
      educationalLevel: module.difficulty,
      timeRequired: `PT${module.estimatedMinutes}M`,
      })),
      ...PREMIUM_TRACKS.flatMap(track => track.modules.map(module => ({
        '@type': 'LearningResource',
        name: module.title,
        url: `${BASE_URL}/learn/premium/${module.id}`,
        educationalLevel: module.difficulty,
        timeRequired: `PT${module.estimatedMinutes}M`,
      }))),
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CourseCatalog courses={courses} />
    </main>
  );
}
