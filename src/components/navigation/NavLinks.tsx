export const NAV_LINKS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Upload', href: '/upload' },
  { label: 'Files', href: '/files' },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];