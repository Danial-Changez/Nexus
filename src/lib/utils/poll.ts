/**
 * Run fn now and again `ms` after each run finishes, pausing while the tab is
 * hidden and refreshing immediately when it becomes visible again. Runs never
 * overlap, so a slow upstream can't stack up requests. Returns a stop fn.
 */
export function poll(fn: () => unknown, ms: number): () => void {
  let id: ReturnType<typeof setTimeout> | undefined
  let generation = 0 // bumped on every start/stop so an older loop exits

  const loop = async (gen: number) => {
    try {
      await fn()
    } catch (err) {
      console.error(err)
    }
    if (gen === generation) id = setTimeout(() => loop(gen), ms)
  }
  const start = () => { clearTimeout(id); loop(++generation) }
  const stop = () => { clearTimeout(id); generation++ }
  const onVisibility = () => document.hidden ? stop() : start()

  document.addEventListener('visibilitychange', onVisibility)
  if (!document.hidden) start()
  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
