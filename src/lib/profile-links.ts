type ProfileIdentifier = string | number | null | undefined;

function normalizeFid(value: ProfileIdentifier): string | null {
  const fid = typeof value === 'number' ? String(value) : value?.trim();
  return fid && /^[1-9]\d*$/.test(fid) ? fid : null;
}

export function profileHref({
  fid,
  username,
}: {
  fid?: ProfileIdentifier;
  username?: string | null;
}): string {
  const normalizedUsername = username?.trim().replace(/^@/, '');
  if (normalizedUsername) return `/profile?user=${encodeURIComponent(normalizedUsername)}`;

  const normalizedFid = normalizeFid(fid);
  return normalizedFid ? `/profile?fid=${encodeURIComponent(normalizedFid)}` : '/profile';
}

export function profileApiUrl({
  fid,
  user,
}: {
  fid: string | null;
  user: string | null;
}): string | null {
  const requestedFid = fid?.trim();
  if (requestedFid) return `/api/profile?fid=${encodeURIComponent(requestedFid)}&casts=true`;

  const normalizedUser = user?.trim().replace(/^@/, '');
  if (!normalizedUser) return null;

  // Older mini apps and notification links placed the FID in `user`.
  if (/^\d+$/.test(normalizedUser)) {
    return `/api/profile?fid=${encodeURIComponent(normalizedUser)}&casts=true`;
  }
  return `/api/profile?username=${encodeURIComponent(normalizedUser)}&casts=true`;
}
