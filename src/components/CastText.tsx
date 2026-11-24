import React from "react";
import Link from "next/link";
import { castTextWithMentions } from "@/lib/cast-mentions";

const LINK_STYLE: React.CSSProperties = {
  color: "#60a5fa",
  textDecoration: "none",
  fontWeight: 600,
};
const TOKEN_OR_URL =
  /(\$[A-Z][A-Z0-9]{0,9}|@fid:\d+|@[a-zA-Z0-9][a-zA-Z0-9_.-]*|https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|lol|xyz|app|dev|co|ai|eth|fyi|gg|wtf|us|uk)[^\s]*)/g;

const stop = (e: React.MouseEvent) => e.stopPropagation();

/** Turns $TICKERS, @mentions and URLs in plain cast text into links. */
export function renderCastText(text: string): React.ReactNode[] {
  return text.split(TOKEN_OR_URL).map((part, i) => {
    if (/^\$[A-Z][A-Z0-9]{0,9}$/.test(part)) {
      return (
        <Link
          key={i}
          href={`/tokens/${encodeURIComponent(part.slice(1))}`}
          style={LINK_STYLE}
          onClick={stop}
        >
          {part}
        </Link>
      );
    }
    const fidMention = part.match(/^@fid:(\d+)$/);
    if (fidMention) {
      return (
        <Link
          key={i}
          href={`/profile?fid=${fidMention[1]}`}
          style={LINK_STYLE}
          onClick={stop}
        >
          {part}
        </Link>
      );
    }
    if (/^@[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part)) {
      // Trailing punctuation ("@alice." / "@bob-") is not part of a username.
      const username = part.slice(1).replace(/[.\-]+$/, "");
      const rest = part.slice(1 + username.length);
      return (
        <React.Fragment key={i}>
          <Link
            href={`/profile?user=${encodeURIComponent(username)}`}
            style={LINK_STYLE}
            onClick={stop}
          >
            @{username}
          </Link>
          {rest}
        </React.Fragment>
      );
    }
    if (
      /^https?:\/\//i.test(part) ||
      /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(part)
    ) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#60a5fa", textDecoration: "none" }}
          onClick={stop}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Cast body with protocol mentions restored and linked. */
export default function CastText({
  cast,
  fallback = "",
}: {
  cast: any;
  fallback?: string;
}) {
  const text = castTextWithMentions(cast) || fallback;
  return <>{renderCastText(text)}</>;
}
