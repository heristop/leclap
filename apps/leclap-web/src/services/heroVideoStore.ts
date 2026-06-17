// Holds the visitor's onboarding-compiled video for the current session only — no persistence, so a
// reload returns to the default hero clip. Lets the Home hero show "your video" right after onboarding.

// Fired after the in-memory hero video changes, so a mounted Home can swap its background live.
export const HERO_VIDEO_UPDATED_EVENT = 'leclap:hero-video-updated';

let currentUrl: string | null = null;

// Point the hero at a fresh object URL for `blob`, revoking the previous one.
export function setHeroVideo(blob: Blob): void {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }

  currentUrl = URL.createObjectURL(blob);
  window.dispatchEvent(new Event(HERO_VIDEO_UPDATED_EVENT));
}

// The current session's hero video URL, or null to use the default clip.
export function getHeroVideoUrl(): string | null {
  return currentUrl;
}
