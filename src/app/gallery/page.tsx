import type { Metadata } from 'next';
import { parseCastGalleryImages } from '@/lib/cast-gallery';

type GallerySearchParams = Promise<{ photos?: string | string[] }>;

export async function generateMetadata({ searchParams }: { searchParams: GallerySearchParams }): Promise<Metadata> {
  const { photos } = await searchParams;
  const images = parseCastGalleryImages(photos);
  const title = images.length ? `Photo gallery · ${images.length} photos | HomieHouse` : 'Photo gallery | HomieHouse';
  const description = images.length
    ? `View ${images.length} photos shared in a HomieHouse cast.`
    : 'Photos shared in a HomieHouse cast.';

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      images: images[0] ? [{ url: images[0], alt: description }] : [],
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images[0] ? [images[0]] : [],
    },
  };
}

export default async function CastPhotoGalleryPage({ searchParams }: { searchParams: GallerySearchParams }) {
  const { photos } = await searchParams;
  const images = parseCastGalleryImages(photos);

  return (
    <main style={{ minHeight: '100dvh', background: '#08080d', color: '#f4f4f5', padding: '32px 16px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <a href="/" style={{ color: '#c4b5fd', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>HomieHouse</a>
        <h1 style={{ margin: '18px 0 6px', fontSize: 28, lineHeight: 1.2 }}>Photo gallery</h1>
        <p style={{ margin: '0 0 24px', color: '#a1a1aa', fontSize: 14 }}>
          {images.length ? `${images.length} photos shared in a cast` : 'This gallery link is empty or invalid.'}
        </p>

        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {images.map((image, index) => (
              <a key={image} href={image} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflow: 'hidden', borderRadius: 14, background: '#18181b', border: '1px solid #27272a' }}>
                <img
                  src={image}
                  alt={`Photo ${index + 1} of ${images.length}`}
                  loading={index > 1 ? 'lazy' : 'eager'}
                  style={{ display: 'block', width: '100%', maxHeight: 720, objectFit: 'contain' }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
