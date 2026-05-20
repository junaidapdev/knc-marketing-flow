// Brand SVGs for TikTok / Instagram / Snapchat / WhatsApp. Shared
// between the InfluencerCard (full-color circular badges) and the
// Influencers page filter chips (monochrome inline glyphs).
//
// lucide-react v1.11 doesn't ship Instagram, TikTok, or WhatsApp, so
// these are hand-rolled. Each accepts a `className` and renders with
// `currentColor` so it inherits the parent's text color when used
// monochrome, or sits on a colored background as a white glyph.

interface IconProps {
  className?: string;
}

export function TikTokIcon({ className }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function SnapchatIcon({ className }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5c5.4 0 8 4.1 8 8.4 0 .6 0 1.2-.1 1.7l.4.3c.5.4 1.4.8 2.2 1 .2 0 .3.2.3.4 0 .1 0 .2-.1.3-.4.5-1.5.9-2.6 1.2l-.4.1c-.1.3-.3.7-.4 1-.1.2-.3.3-.5.3-.4 0-.9-.1-1.4-.2-.4-.1-.8-.1-1.1 0-.5.1-1 .5-1.7.9-1 .6-2 1.3-3.4 1.3-1.4 0-2.5-.7-3.4-1.3-.7-.4-1.2-.8-1.7-.9-.3-.1-.7-.1-1.1 0-.5.1-1 .2-1.4.2-.2 0-.4-.1-.5-.3-.1-.3-.3-.7-.4-1l-.4-.1c-1.1-.3-2.2-.7-2.6-1.2-.1-.1-.1-.2-.1-.3 0-.2.1-.4.3-.4.8-.2 1.7-.6 2.2-1l.4-.3c-.1-.5-.1-1.1-.1-1.7C4 4.6 6.6.5 12 .5z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0zm0 22c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.5 15.7 2 13.9 2 12 2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
    </svg>
  );
}
