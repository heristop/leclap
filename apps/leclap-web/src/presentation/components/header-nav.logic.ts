// The header's primary navigation, shared by the desktop bar and the mobile sheet. Kept apart from
// Header.tsx so the rule deciding which entries show is unit-tested without a DOM.

// href carries the route; labelKey resolves to a common.nav.* translation.
export const navigationItems = [
  { labelKey: 'nav.home', href: '/' },
  // Studio is the create-a-video flow; Templates is the template manager/authoring area.
  { labelKey: 'nav.studio', href: '/studio' },
  { labelKey: 'nav.templates', href: '/templates' },
  // Projects lists only what this browser has saved, so the link waits until there is something to
  // list. The route itself stays reachable, empty state and all, for anyone who bookmarked it.
  { labelKey: 'nav.projects', href: '/projects', needsProjects: true },
  { labelKey: 'nav.docs', href: '/doc' },
  { labelKey: 'nav.about', href: '/about' },
] as const;

export type NavItem = (typeof navigationItems)[number];

/** The entries to render: all of them, minus Projects while this browser has no saved project. */
export const visibleNavItems = (hasProjects: boolean): readonly NavItem[] =>
  navigationItems.filter((item) => hasProjects || !('needsProjects' in item));
