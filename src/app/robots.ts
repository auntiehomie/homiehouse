import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/feed', '/learn', '/trending', '/ask-homie', '/notes', '/tokens'],
        disallow: [
          '/api/',
          '/settings/',
          '/compose',
          '/profile',
          '/notifications',
          '/scheduled',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
