// Single source for navigation: sidebar, phone tab bar, command palette, 1–6 shortcuts.
export const PAGES = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'metrics', label: 'Metrics', icon: 'chart' },
  { id: 'services', label: 'Services', icon: 'link' },
  { id: 'containers', label: 'Containers', icon: 'container' },
  { id: 'network', label: 'Network', icon: 'global' },
  { id: 'media', label: 'Media', icon: 'clapperboard' },
]

export const PAGE_IDS = PAGES.map(p => p.id)
