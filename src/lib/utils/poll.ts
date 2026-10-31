/**
 * Run fn now and every `ms`, pausing while the tab is hidden and
 * refreshing immediately when it becomes visible again. Returns a stop fn.
 */
export function poll(fn: () => unknown, ms: number): () => void {
  let id: ReturnType<typeof setInterval> | undefined
  const start = () => {
    clearInterval(id)
    fn()
    id = setInterval(fn, ms)
  }
  const onVisibility = () => document.hidden ? clearInterval(id) : start()
  document.addEventListener('visibilitychange', onVisibility)
  if (!document.hidden) start()
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
