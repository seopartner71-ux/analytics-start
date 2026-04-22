import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** Uploaded avatar URL, if any. */
  avatarUrl?: string | null;
  /** Used both for fallback initials and as a deterministic seed for the default avatar. */
  name?: string | null;
  /** Optional alternate seed (e.g., user id/email) when name is generic. */
  seed?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a user's avatar with a uploaded image, or a deterministic generated
 * default (DiceBear initials) when none is provided. Falls back to text initials
 * if the image fails to load.
 */
export function UserAvatar({ avatarUrl, name, seed, className, fallbackClassName }: UserAvatarProps) {
  const url = resolveAvatarUrl(avatarUrl, seed || name);
  const initials = getInitials(name || seed);
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarImage src={url} alt={name || "Avatar"} />
      <AvatarFallback className={cn("text-[11px]", fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  );
}
