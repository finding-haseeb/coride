import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';
const FRIENDS_TTL_MS = 30_000;

const authHeader = (socket) => ({ headers: { Authorization: `Bearer ${socket.token}` }, timeout: 5000 });

/**
 * Friends of the socket's user, cached briefly. The backend already hides
 * blocked users from this list, so a block takes effect within the TTL.
 */
export async function getFriendIds(socket, { force = false } = {}) {
  const cache = socket.data.friends;
  if (!force && cache && Date.now() - cache.at < FRIENDS_TTL_MS) return cache.ids;
  const res = await axios.get(`${BACKEND_URL}/friendships/friends`, authHeader(socket));
  const ids = new Set((res.data?.data || []).map((f) => String(f.id)));
  socket.data.friends = { ids, at: Date.now() };
  return ids;
}

/** True when `otherId` is a current friend; refreshes the cache once on a miss. */
export async function canTalkTo(socket, otherId) {
  if (!otherId || otherId === socket.userId) return false;
  try {
    if ((await getFriendIds(socket)).has(otherId)) return true;
    return (await getFriendIds(socket, { force: true })).has(otherId);
  } catch (err) {
    console.error('Friend check failed:', err.message);
    return false;
  }
}

/** True when the user is a member of the group (checked by the backend). */
export async function isGroupMember(socket, groupId) {
  if (!groupId) return false;
  try {
    await axios.get(`${BACKEND_URL}/groups/${encodeURIComponent(groupId)}`, authHeader(socket));
    return true;
  } catch {
    return false;
  }
}
