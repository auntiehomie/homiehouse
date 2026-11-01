# Homiehouse Knowledge Base

This directory is the source of truth for Homiehouse's learning articles. It contains a curated set of source links, short summaries, and explicit learning points. The wider Rufus Vault and personal reading archive are not runtime dependencies and must not be copied wholesale here.

## How content is used

- The Learn Hub reads this file directly when it selects article-backed modules for a learning plan. It does not wait for Neon or a scheduled sync.
- The plan-generation prompt receives each selected article's title, source URL, summary, takeaways, and tags. The generated plan remains bounded by the learner's track and level.
- The hourly `/api/agent/kb-sync` job mirrors the same records into Neon for Ask Homie retrieval, search, semantic indexing, and the posting agent.
- The app shows a source link on each article-backed module. Source casts remain untrusted prompts; article text is context, not instructions.

## Add an article

Append one object to `articles.json` with these fields:

- `id`: stable lowercase kebab-case identifier.
- `title`, `url`, and `source`: source title, canonical HTTPS URL, and host.
- `tags`: one or more curriculum topics, such as `ai`, `creator-economy`, `privacy`, `dao`, or `network states`.
- `summary`: a concise, source-grounded paraphrase. Note when only an abstract, excerpt, or metadata was reviewed.
- `learningPoints`: at least two explicit learning outcomes or takeaways.
- `addedAt`: ISO date or `null`.
- `reviewStatus`: currently `curated-summary`.

Do not add credentials, personal notes, private annotations, or full copyrighted articles. Keep the entry tied to a public source, and add a focused test or update the existing corpus assertions when the schema or selection behavior changes.

The data is mirrored into Neon by the existing hourly sync after deployment. The Learn Hub uses the repository copy immediately, so new entries can inform generated modules as soon as that code is deployed.
