// Fields of another user that are safe to show publicly.
// Never include email, password, tokens or emergency contacts here.
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  profile_image: true,
  ratings: true,
  ratingCount: true,
  emailVerified: true,
  gender: true,
  birthYear: true,
  interests: true,
};

export const SHORT_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  profile_image: true,
  emailVerified: true,
};

/** Drops secrets from a full user row. */
export function stripPrivate(user) {
  if (!user) return user;
  // eslint-disable-next-line no-unused-vars
  const { password, verifyToken, verifyExpiresAt, ...rest } = user;
  return rest;
}

/** Same as stripPrivate, plus fields only the owner may see. */
export function toPublicProfile(user) {
  if (!user) return user;
  // eslint-disable-next-line no-unused-vars
  const { email, emergencyContacts, json, ...rest } = stripPrivate(user);
  return rest;
}
