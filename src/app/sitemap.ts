import type { MetadataRoute } from 'next';
import { SAFETY_MODULES } from '@/lib/safety-curriculum';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export default function sitemap(): MetadataRoute.Sitemap {
  const lessonPages: MetadataRoute.Sitemap = SAFETY_MODULES.map((module) => ({
    url: `${BASE_URL}/learn/library/${module.id}`,
    lastModified: new Date('2026-09-19'),
    changeFrequency: 'monthly',
    priority: 0.72,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/feed`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/learn`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/learn/library`,
      lastModified: new Date('2026-09-19'),
      changeFrequency: 'weekly',
      priority: 0.82,
    },
    {
      url: `${BASE_URL}/community`,
      lastModified: new Date('2026-09-19'),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/ask-homie`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/notes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/tokens`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
    ...lessonPages,
  ];
}
