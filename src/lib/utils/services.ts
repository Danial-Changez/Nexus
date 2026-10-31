import type { ServiceItem, ServiceStatus } from '../types.js'

/** Down services first, otherwise keep config order. */
export function downFirst(items: ServiceItem[], status: Map<string, ServiceStatus>): ServiceItem[] {
  const isDown = (s: ServiceItem) => status.get(s.href)?.status === 'down' ? 0 : 1
  return [...items].sort((a, b) => isDown(a) - isDown(b))
}
