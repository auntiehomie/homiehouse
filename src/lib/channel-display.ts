/** Return a readable registry label without substituting a channel's identity. */
export function channelDisplayName(channel: { id?: unknown; name?: unknown }): string | null {
  const id = typeof channel.id === 'string' ? channel.id.trim() : '';
  if (!id) return null;
  const isOpaque = (value: string) => /[:/]/.test(value) || /^0x[0-9a-f]{20,}$/i.test(value);
  const name = typeof channel.name === 'string' ? channel.name.trim() : '';
  if (name && !isOpaque(name)) return name;
  return isOpaque(id) ? null : id.replace(/^\//, '');
}
