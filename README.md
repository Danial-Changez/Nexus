# Nexus

A homelab dashboard built with Svelte 5 and Express 5. Monitors host resources via Glances, tracks service uptime, displays Docker containers, network traffic, and media stack stats.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA)                                              │
│  Svelte 5 + Vite 7 │ hash-based routing │ inline SVG icons │
└────────────┬────────────────────────────────────────────────┘
             │  fetch /api/*
┌────────────▼────────────────────────────────────────────────┐
│  Express 5 Server (server/index.ts)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ glances-proxy │  │ pihole-proxy │  │ media-proxy  │      │
│  │   (Router)    │  │  (session)   │  │  (aggregate) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐      │
│  │ video-dl     │  │   wol.ts     │  │  env.ts      │      │
│  │  (timeout)   │  │ (UDP magic)  │  │  log.ts      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
             │
     ┌───────┼──────────┬──────────┬──────────┐
     ▼       ▼          ▼          ▼          ▼
  Glances  Pi-hole   qBit/NZB   Sonarr/    video-dl
  (hosts)  (DNS)     (torrent)  Radarr     (custom)
```

**Key design decisions:**

- **Server-side API proxying** — API keys and session tokens never reach the
  browser. The Express server authenticates with each upstream service and
  forwards sanitized JSON.
- **Inline SVG icons** — All UI chrome icons are bundled as raw SVG paths in
  `Icon.svelte`, eliminating ~40 external CDN requests per page load. Service
  icons (sonarr, radarr, etc.) still use jsdelivr CDN since they're
  user-configured.
- **No build step for the server** — Server TypeScript runs directly via `tsx`.
  Vite only builds the client SPA to `dist/`.

## Features

- **Host metrics** — CPU, memory, disk, and uptime from Glances API endpoints
- **Service monitoring** — uptime checks with latency for all configured services
- **Container overview** — Docker containers across all hosts with CPU/memory stats
- **Network traffic** — per-interface bandwidth with sparkline history charts
- **Pi-hole stats** — DNS query stats via server-side proxy
- **Media stack** — qBittorrent, NZBGet, Sonarr, Radarr, Prowlarr stats via server-side proxy
- **Wake-on-LAN** — Wake/shutdown remote machines via Pi-hole MAC lookup + UDP magic packet
- **Video downloader** — Live download progress for custom Turkish episode fetcher
- **Dark theme** — OKLCH color tokens, minimal UI

## Quick Start

```yaml
services:
  nexus:
    build: .
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/config/config.json:ro
    restart: unless-stopped
```

Create a `config.json` (see [examples/config.json](examples/config.json)) and a `.env` file with your media service credentials.

## Configuration

Nexus loads its dashboard configuration from a JSON file mounted at `/config/config.json` (override with `CONFIG_PATH` env var).

```json
{
  "services": [
    {
      "section": "Infrastructure",
      "items": [
        { "name": "Pi-hole", "icon": "pi-hole", "href": "https://pihole.example.com", "desc": "DNS & DHCP" }
      ]
    }
  ],
  "hosts": [
    { "name": "Docker VM", "key": "docker", "url": "https://glances-docker.example.com" }
  ],
  "overview_services": ["Pi-hole", "Plex"]
}
```

| Field | Description |
|---|---|
| `services` | Service groups shown on the Services page. `icon` can be a short name (resolved from [dashboard-icons](https://github.com/walkxcode/dashboard-icons)) or a full URL |
| `hosts` | Glances hosts to monitor. `key` is used internally, `url` is the Glances API base URL |
| `overview_services` | Service names to show on the Overview page (subset of services). Omit to show all |

## Environment Variables

Required only if using the media stats page. Passed via `env_file` or `environment` in compose.

| Variable | Description |
|---|---|
| `PIHOLE_URL` | Pi-hole API URL |
| `PIHOLE_PASSWORD` | Pi-hole admin password |
| `QBIT_URL` | qBittorrent web UI URL |
| `HOMEPAGE_VAR_QBIT_USER` | qBittorrent username |
| `HOMEPAGE_VAR_QBIT_PASS` | qBittorrent password |
| `NZBGET_URL` | NZBGet URL |
| `HOMEPAGE_VAR_NZBGET_USER` | NZBGet username |
| `HOMEPAGE_VAR_NZBGET_PASS` | NZBGet password |
| `SONARR_URL` | Sonarr URL |
| `HOMEPAGE_VAR_SONARR_KEY` | Sonarr API key |
| `RADARR_URL` | Radarr URL |
| `HOMEPAGE_VAR_RADARR_KEY` | Radarr API key |
| `PROWLARR_URL` | Prowlarr URL |
| `HOMEPAGE_VAR_PROWLARR_KEY` | Prowlarr API key |
| `VIDEO_DL_1_URL` | Video downloader API URL |
| `CONFIG_PATH` | Config file path (default: `/config/config.json`) |
| `NEXUS_API_TOKEN` | If set, `POST /api/wol/wake` and `/api/wol/shutdown` require a matching `X-Nexus-Token` header (the UI prompts once and stores it in localStorage). Unset = unauthenticated (a warning is logged) |

## Project Structure

```
nexus/
├── server/                 # Express API server (TypeScript, run via tsx)
│   ├── index.ts            # Entry point, mounts middleware
│   ├── glances-proxy.ts    # Proxies Glances API per host
│   ├── pihole-proxy.ts     # Pi-hole v6 auth + stats
│   ├── media-proxy.ts      # qBit, NZBGet, Sonarr, Radarr, Prowlarr aggregate
│   ├── video-dl-proxy.ts   # Custom video downloader status
│   ├── wol.ts              # Wake-on-LAN via Pi-hole MAC lookup + UDP
│   ├── env.ts              # Loads .env from config dir
│   └── log.ts              # Structured logger
├── src/
│   ├── App.svelte          # Root component, routing, data fetching
│   ├── app.css             # Design tokens (OKLCH), global styles
│   ├── lib/
│   │   ├── components/     # Reusable Svelte 5 components
│   │   ├── config/         # Constants (CDN base URL)
│   │   ├── types.ts        # Shared TypeScript interfaces
│   │   └── utils/          # Format helpers (bytes, rates)
│   └── pages/              # Page-level components (one per route)
├── Dockerfile              # Multi-stage: build client, run server with tsx
├── vite.config.ts          # Svelte plugin + dev-server API proxies
└── package.json
```

## Development

```bash
npm install
npm run dev          # Vite dev server with API proxies on :5173
```

## Production

```bash
npm run build        # Build client SPA to dist/
npm run start        # Start Express server on :3000
```

## Scripts

| Script         | Description                          |
| -------------- | ------------------------------------ |
| `dev`          | Vite dev server with HMR             |
| `build`        | Production client build              |
| `start`        | Run Express server via tsx            |
| `check`        | Svelte type checking                 |
| `check:server` | Server TypeScript type checking      |
| `lint`         | ESLint (Svelte + TypeScript)         |
