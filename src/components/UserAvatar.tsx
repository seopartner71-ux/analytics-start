import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<UserAvatarSize, { box: string; text: string; px: number }> = {
  xs: { box: "h-5 w-5", text: "text-[9px]", px: 40 },
  sm: { box: "h-7 w-7", text: "text-[10px]", px: 56 },
  md: { box: "h-9 w-9", text: "text-[11px]", px: 72 },
  lg: { box: "h-12 w-12", text: "text-sm", px: 96 },
  xl: { box: "h-20 w-20", text: "text-lg", px: 160 },
};

interface UserAvatarProps {
  /** Uploaded avatar URL, if any. */
  avatarUrl?: string | null;
  /** Used both for fallback initials and as a deterministic seed for the default avatar. */
  name?: string | null;
  /** Optional alternate seed (e.g., user id/email) when name is generic. */
  seed?: string | null;
  /** Standard size preset. Defaults to "md". */
  size?: UserAvatarSize;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a user's avatar with a uploaded image, or a deterministic generated
 * default (DiceBear initials) when none is provided. Falls back to text initials
 * if the image fails to load.
 */
export function UserAvatar({
  avatarUrl,
  name,
  seed,
  size = "md",
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const cfg = SIZE_MAP[size];
  const url = resolveAvatarUrl(avatarUrl, seed || name, cfg.px);
  const initials = getInitials(name || seed);
  return (
    <Avatar className={cn(cfg.box, className)}>
      <AvatarImage src={url} alt={name || "Avatar"} />
      <AvatarFallback className={cn(cfg.text, fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  );
}
