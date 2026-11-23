const HOST_ICONS: Record<string, string> = { docker: 'container', proxmox: 'server', truenas: 'hardDrive' }

/** Icon for a Glances host key; unknown hosts get the generic server icon. */
export const hostIcon = (key: string): string => HOST_ICONS[key] ?? 'server'

/** Loopback, Docker bridges and veth pairs aren't physical network interfaces. */
export const isVirtualInterface = (name: string): boolean => /^(lo|docker|veth|br-)/.test(name)
