// One shared 1s tick for every "Xs ago" label and the sidebar clock.
export const clock = $state({ now: Date.now() })
setInterval(() => clock.now = Date.now(), 1000)
