// Power requests from the command palette, handled by the WoL controls in Header.
// Shutdown only arms the confirm step; it never fires directly.
export const power = $state<{ request: 'wake' | 'shutdown' | null }>({ request: null })
