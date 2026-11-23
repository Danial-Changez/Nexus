import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { check } from './status.ts'

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
