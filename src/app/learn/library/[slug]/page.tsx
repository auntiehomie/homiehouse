import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SAFETY_CURRICULUM, getSafetyLesson } from "@/lib/safety-curriculum";
import { serializeJsonLd } from "@/lib/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://homiehouse.lol";

export function generateStaticParams() {
  return SAFETY_CURRICULUM.map(({ module }) => ({ slug: module.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getSafetyLesson(slug);
  if (!lesson) return {};
  const url = `${BASE_URL}/learn/library/${slug}`;
  const imageUrl = `${BASE_URL}/api/og/content?kind=crypto%20safety%20lesson&title=${encodeURIComponent(lesson.module.title)}&description=${encodeURIComponent(lesson.module.description)}`;
  return {
    title: lesson.module.title,
    description: lesson.module.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: lesson.module.title,
      description: lesson.module.description,
      url,
      images: [imageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title: lesson.module.title,
      description: lesson.module.description,
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl,
        button: {
          title: "Read lesson",
          action: { type: "launch_miniapp", name: "HomieHouse", url },
        },
      }),
      "fc:frame": JSON.stringify({
        version: "1",
        imageUrl,
        button: {
          title: "Read lesson",
          action: { type: "launch_frame", name: "HomieHouse", url },
        },
      }),
    },
  };
}

export default async function PublicLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getSafetyLesson(slug);
  if (!lesson) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.module.title,
    description: lesson.module.description,
    url: `${BASE_URL}/learn/library/${slug}`,
    educationalLevel: lesson.module.difficulty,
    timeRequired: `PT${lesson.module.estimatedMinutes}M`,
    learningResourceType: "lesson",
    teaches: lesson.module.objectives,
    provider: { "@type": "Organization", name: "HomieHouse", url: BASE_URL },
  };

  const shareText = `I’m learning how to stay safer in crypto: ${lesson.module.title}\n\n${BASE_URL}/learn/library/${slug}\n\n#HomieHouseLearning #StayInTheGame`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav
        aria-label="Breadcrumb"
        className="mb-8 text-sm text-[var(--muted-on-dark)]"
      >
        <Link href="/learn/library" className="text-[var(--accent)]">
          Safety Library
        </Link>{" "}
        <span aria-hidden="true">/</span> {lesson.module.title}
      </nav>

      <article>
        <header>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-on-dark)]">
            <span>{lesson.module.difficulty}</span>
            <span aria-hidden="true">•</span>
            <span>{lesson.module.estimatedMinutes} minutes</span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {lesson.module.title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">
            {lesson.intro}
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-bold">What you will learn</h2>
          <ul className="mt-4 space-y-3 text-[var(--muted-on-dark)]">
            {lesson.module.objectives.map((objective) => (
              <li key={objective} className="flex gap-3">
                <span className="text-[var(--accent)]">✓</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 space-y-10">
          {lesson.concepts.map((concept) => (
            <section key={concept.title}>
              <h2 className="text-2xl font-bold">{concept.title}</h2>
              <p className="mt-4 text-base leading-8 text-[var(--muted-on-dark)]">
                {concept.explanation}
              </p>
              {concept.analogy && (
                <p className="mt-4 rounded-xl border-l-4 border-[var(--accent)] bg-[var(--surface)] p-4 italic leading-7 text-[var(--muted-on-dark)]">
                  {concept.analogy}
                </p>
              )}
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-bold">Put it into practice</h2>
          <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">
            {lesson.practicalExample}
          </p>
          <ol className="mt-5 space-y-3 text-[var(--muted-on-dark)]">
            {lesson.quickActions.map((action, index) => (
              <li key={action} className="flex gap-3">
                <span className="font-bold text-[var(--accent)]">
                  {index + 1}.
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">Sources and further reading</h2>
          <ul className="mt-4 space-y-2">
            {lesson.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline underline-offset-4"
                >
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-12 border-t border-[var(--border)] pt-8">
          <p className="font-semibold">{lesson.summary}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-on-dark)]">
            Educational content only, not individualized financial advice.
            Verify current information and never risk essential funds.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/learn?track=survival"
              className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white no-underline"
            >
              Take the interactive track
            </Link>
            <Link
              href={`/compose?text=${encodeURIComponent(shareText)}`}
              className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text-on-dark)] no-underline"
            >
              Share what you learned
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
