"use client";

import React, { useEffect, useState } from "react";
import { fallbackAvatar, isRtdbAvatar, resolveRtdbAvatar } from "@/lib/media/avatar";

interface AvatarProps {
  src?: string;
  name: string;
  className?: string;
  alt?: string;
}

/**
 * Profile picture that understands every avatar source used by the app:
 * external URL, inline data URL, or an avatar:// reference stored in the Realtime Database.
 * Falls back to an initials image when nothing is available or the image fails to load.
 */
export default function Avatar({ src, name, className = "", alt }: AvatarProps) {
  const fallback = fallbackAvatar(name);
  const [resolved, setResolved] = useState<string>(() => (src && !isRtdbAvatar(src) ? src : fallback));

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved(fallback);
      return;
    }
    if (!isRtdbAvatar(src)) {
      setResolved(src);
      return;
    }
    setResolved(fallback);
    resolveRtdbAvatar(src).then((url) => {
      if (!cancelled && url) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, name]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt ?? name}
      className={className}
      onError={() => {
        if (resolved !== fallback) setResolved(fallback);
      }}
    />
  );
}
