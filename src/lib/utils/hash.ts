// Hash shape: #page?key=value — page selects the view, params hold view state.

export function hashPage(): string {
  return location.hash.slice(1).split('?')[0]
}

export function getParam(key: string): string | null {
  return new URLSearchParams(location.hash.split('?')[1] ?? '').get(key)
}

/** Update one param without adding a history entry or firing hashchange. */
export function setParam(key: string, value: string | null | undefined): void {
  const [page, query = ''] = location.hash.slice(1).split('?')
  const params = new URLSearchParams(query)
  if (value) params.set(key, value)
  else params.delete(key)
  const q = params.toString()
  history.replaceState(null, '', `#${page}${q ? `?${q}` : ''}`)
}
