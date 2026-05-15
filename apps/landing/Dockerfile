# apps/landing/Dockerfile — Susurra landing (dev mode with HMR)
# Build context is the MONOREPO ROOT (set in docker-compose.yml).
# Dev workflow: pnpm dev runs Next.js with hot reload; host source is volume-mounted.

FROM node:20-alpine AS base
WORKDIR /repo

RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/landing/package.json ./apps/landing/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# Override the package.json `dev` script's hardcoded --port 3001; we use 3000
# inside the container and map to host 3007 via compose.
CMD ["pnpm", "--filter", "landing", "dev", "--port", "3000", "--hostname", "0.0.0.0"]
