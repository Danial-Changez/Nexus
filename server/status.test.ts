import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { check, record, statusMiddleware, type ServiceHistory } from './status.ts'

test('a service is up unless it answers 5xx or does not answer at all', async () => {
  const server = createServer((req, res) => {
    const code = req.url === '/login' ? 302 : req.url === '/auth' ? 401 : req.url === '/bad' ? 502 : 200
    res.writeHead(code, code === 302 ? { Location: '/x' } : {}).end()
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    assert.equal((await check(`${base}/ok`)).up, true)

    const login = await check(`${base}/login`)
    assert.equal(login.up, true, 'a login redirect counts as up')
    assert.equal(login.code, 302)

    assert.equal((await check(`${base}/auth`)).up, true, 'a 401 still means the service answered')

    const bad = await check(`${base}/bad`)
    assert.equal(bad.up, false)
    assert.equal(bad.code, 502)

    const dead = await check('http://127.0.0.1:1')
    assert.equal(dead.up, false)
    assert.equal(dead.latency, null)
  } finally {
    server.close()
  }
})

/** Read one service's entry the way the browser does, through GET /api/status. */
async function statusFor(href: string): Promise<ServiceHistory> {
  const body = await new Promise<string>(resolve => {
    const res = { setHeader() {}, end: resolve } as unknown as ServerResponse
    statusMiddleware({ url: '/api/status' } as IncomingMessage, res, () => {})
  })
  return JSON.parse(body)[href]
}

test('an outage longer than the history window keeps its real start time', async () => {
  const href = 'http://long-outage.test'
  record(href, { up: true, latency: 5, at: 0 })
  for (let i = 1; i <= 40; i++) record(href, { up: false, latency: null, at: i * 30_000 })

  const down = await statusFor(href)
  assert.equal(down.history.length, 30, 'history is still capped at 30 checks')
  assert.equal(down.downSince, 30_000, 'the outage began at the first failed check, 40 checks ago')

  record(href, { up: true, latency: 5, at: 41 * 30_000 })
  assert.equal((await statusFor(href)).downSince, undefined, 'recovery clears it')
})
