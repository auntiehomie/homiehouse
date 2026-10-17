import { getAuthHeaders, getStoredFid } from './client-auth';

const SIGN_IN_ERROR = 'Sign in again to check your Pro access. You do not need to pay again.';

export async function fetchProStatus(fid: number, signal?: AbortSignal): Promise<boolean> {
  const headers = getAuthHeaders('read:all');
  if (!headers) throw new Error(SIGN_IN_ERROR);
  const response = await fetch(`/api/pro-status?fid=${fid}`, { headers: { ...headers }, cache: 'no-store', signal });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to check Pro access. Please retry.');
  return data.is_pro === true;
}

export function fetchPremiumTrack(moduleId?: string, signal?: AbortSignal): Promise<Response> {
  const headers = getAuthHeaders('read:all');
  if (!headers && getStoredFid()) throw new Error(SIGN_IN_ERROR);
  const query = moduleId ? `?module=${encodeURIComponent(moduleId)}` : '';
  return fetch(`/api/premium-track${query}`, { headers: { ...headers }, cache: 'no-store', signal });
}
