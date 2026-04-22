/**
 * Generates a deterministic default avatar URL based on a seed (name/email/id).
 * Uses DiceBear (no API key, free, fast SVG generation).
 */
export function getDefaultAvatar(seed: string | null | undefined, size = 200): string {
  const safeSeed = (seed && seed.trim()) || "user";
  const encoded = encodeURIComponent(safeSeed);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encoded}&size=${size}&backgroundType=gradientLinear&fontFamily=Inter&fontWeight=600`;
}

/**
 * Returns the best available avatar URL: uploaded one or generated default.
 */
export function resolveAvatarUrl(
  uploaded: string | null | undefined,
  seed: string | null | undefined,
  size = 200,
): string {
  return uploaded && uploaded.trim() ? uploaded : getDefaultAvatar(seed, size);
}

/** Compute up to 2-letter initials from a name or email. */
export function getInitials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "?";
  const v = nameOrEmail.trim();
  if (!v) return "?";
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return v.slice(0, 2).toUpperCase();
}
