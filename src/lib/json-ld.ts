/**
 * Serialize data for a <script type="application/ld+json"> block.
 * JSON.stringify does not escape `<`, so a value containing `</script>` would
 * otherwise close the element and allow markup injection.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
