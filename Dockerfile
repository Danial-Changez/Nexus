# ── Build stage ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssh-client

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run as the image's unprivileged node user (UID 1000)
USER node

CMD ["node", "server/index.ts"]
