FROM node:22-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1


# ------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


# ------------------------------------------------------------
# Builder
# ------------------------------------------------------------

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Valid URL so Prisma/Next can initialize during the build.
# The production runtime receives the real DATABASE_URL.
ENV DATABASE_URL="postgresql://barca:build-only@127.0.0.1:5432/barca_dashboard"

RUN npx prisma contract emit

RUN npm run build


# ------------------------------------------------------------
# Migration image
# ------------------------------------------------------------

FROM base AS migrate

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY migrations ./migrations
COPY src/prisma ./src/prisma

CMD ["npx", "prisma", "db", "migrate", "--advance-ref", "db"]


# ------------------------------------------------------------
# Production web image
# ------------------------------------------------------------

FROM node:22-alpine AS web

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder \
  --chown=nextjs:nodejs \
  /app/.next/standalone ./

COPY --from=builder \
  --chown=nextjs:nodejs \
  /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]