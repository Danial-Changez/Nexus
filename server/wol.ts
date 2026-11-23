/**
 * Wake-on-LAN support — sends a UDP magic packet to the MAC configured in
 * config.json. Pi-hole is consulted for live status (lastQuery) and for
 * resolving the device's current IP on SSH shutdown, but waking the device
 * does not depend on Pi-hole at all.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { createSocket } from 'dgram'
import { execFile } from 'child_process'
import { piholeRequest } from './pihole-proxy.ts'
import { logger } from './log.ts'

const SSH_KEY = '/config/ssh_key'

const log = logger('wol')
const API_TOKEN = process.env.NEXUS_API_TOKEN || ''

export interface WolConfig {
  name?: string
  hostname: string
  ssh_user?: string
  mac: string
  broadcast?: string
}

interface PiholeDevice {
  hwaddr: string
  lastQuery: number
  ips?: { name: string; ip: string }[]
}

let wolConfig: WolConfig | null = null

export function initWol(cfg: WolConfig | undefined): void {
  if (!cfg) return
  if (!cfg.mac) {
    log.warn(`WoL config present but missing "mac" field — WoL disabled`)
    return
  }
  wolConfig = cfg
  log.info(`WoL enabled for "${cfg.name || cfg.hostname}" (MAC ${cfg.mac}, broadcast ${cfg.broadcast || '255.255.255.255'})`)
  if (!API_TOKEN) {
    log.warn('NEXUS_API_TOKEN not set — wake/shutdown endpoints are disabled')
  }
}

function createMagicPacket(mac: string): Buffer {
  const macBytes = Buffer.from(mac.replace(/[:-]/g, ''), 'hex')
  const packet = Buffer.alloc(102)
  for (let i = 0; i < 6; i++) packet[i] = 0xff
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6)
  return packet
}

function sendMagicPacket(mac: string, broadcast: string): Promise<void> {
  // Send to the configured broadcast and the global one; succeed if any
  // send succeeds, otherwise surface the first error.
  const addresses = [...new Set([broadcast, '255.255.255.255'])]
  return new Promise((resolve, reject) => {
    const packet = createMagicPacket(mac)
    const socket = createSocket('udp4')
    socket.once('error', err => { socket.close(); reject(err) })
    socket.bind(() => {
      socket.setBroadcast(true)
      let pending = addresses.length
      let sent = false
      let firstErr: Error | null = null
      const done = (err: Error | null) => {
        if (err) firstErr = firstErr || err
        else sent = true
        if (--pending === 0) {
          socket.close()
          if (sent) resolve()
          else reject(firstErr || new Error('Send failed'))
        }
      }
      for (const addr of addresses) socket.send(packet, 0, packet.length, 9, addr, done)
    })
  })
}

function matchesHost(name?: string): boolean {
  const hostname = wolConfig!.hostname.toLowerCase()
  const n = (name || '').toLowerCase()
  return n === hostname || n === hostname.replace(/\.lan$/, '')
}

async function findDevice(): Promise<PiholeDevice> {
  const data = await piholeRequest('/network/devices?max_devices=9999&max_addresses=9999')
  const devices: PiholeDevice[] = data.devices || []
  const device = devices.find(d => (d.ips || []).some(e => matchesHost(e.name)))
  if (!device) throw new Error(`Device "${wolConfig!.hostname}" not found in Pi-hole network table`)
  return device
}

function getDeviceIp(device: PiholeDevice): string | null {
  // IPv4 only — the colon check excludes IPv6 entries
  return (device.ips || []).find(e => matchesHost(e.name) && e.ip && !e.ip.includes(':'))?.ip || null
}

function jsonRes(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

type NextFn = () => void

export function wolMiddleware(req: IncomingMessage, res: ServerResponse, next: NextFn): void {
  if (!wolConfig) return next()

  if (req.url === '/api/wol/status' && req.method === 'GET') {
    handleStatus(res)
    return
  }

  if ((req.url === '/api/wol/shutdown' || req.url === '/api/wol/wake') && req.method === 'POST') {
    // Wake/shutdown change state (shutdown SSHes into the machine), so they
    // stay off until NEXUS_API_TOKEN is set, then need a matching X-Nexus-Token.
    if (!API_TOKEN) {
      jsonRes(res, 503, { error: 'Wake and shutdown are disabled until NEXUS_API_TOKEN is set' })
      return
    }
    if (req.headers['x-nexus-token'] !== API_TOKEN) {
      log.warn(`Unauthorized ${req.url} attempt`)
      jsonRes(res, 401, { error: 'Invalid or missing API token' })
      return
    }
    if (req.url === '/api/wol/shutdown') handleShutdown(res)
    else handleWake(res)
    return
  }

  next()
}

async function handleStatus(res: ServerResponse): Promise<void> {
  try {
    const device = await findDevice()
    const age = Math.floor(Date.now() / 1000) - (device.lastQuery || 0)
    jsonRes(res, 200, { name: wolConfig!.name || wolConfig!.hostname, online: age < 300 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.warn(`Pi-hole status lookup failed, reporting offline: ${message}`)
    jsonRes(res, 200, { name: wolConfig!.name || wolConfig!.hostname, online: false })
  }
}

async function handleShutdown(res: ServerResponse): Promise<void> {
  if (!wolConfig!.ssh_user) {
    jsonRes(res, 400, { error: 'No ssh_user configured' })
    return
  }
  try {
    const device = await findDevice()
    const ip = getDeviceIp(device)
    if (!ip) throw new Error('No IP address found for device')
    log.info(`Sending shutdown to ${ip} via SSH`)
    await new Promise<void>((resolve, reject) => {
      execFile('ssh', [
        '-i', SSH_KEY,
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=5',
        `${wolConfig!.ssh_user}@${ip}`,
        'shutdown', '/s', '/full', '/f', '/t', '0',
      ], (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr.trim() || err.message))
        else resolve()
      })
    })
    jsonRes(res, 200, { success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error(`WoL shutdown failed: ${message}`)
    jsonRes(res, 502, { error: message })
  }
}

async function handleWake(res: ServerResponse): Promise<void> {
  const broadcast = wolConfig!.broadcast || '255.255.255.255'
  try {
    log.info(`Sending WoL magic packet to ${wolConfig!.mac} via ${broadcast}`)
    await sendMagicPacket(wolConfig!.mac, broadcast)
    jsonRes(res, 200, { success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error(`WoL wake failed: ${message}`)
    jsonRes(res, 502, { error: message })
  }
}
