FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p \
  storage/uploads \
  storage/state \
  storage/previews \
  storage/exports \
  storage/packets

EXPOSE 3001

CMD ["node_modules/.bin/next", "start", "--port", "3001"]
