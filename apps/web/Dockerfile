# apps/web/Dockerfile — Susurra web (dev mode with HMR)
# Build context is the MONOREPO ROOT (set in docker-compose.yml).
# Dev workflow: pnpm dev runs Next.js with hot reload; host source is volume-mounted.

FROM node:20-alpine AS base
WORKDIR /repo

# libc6-compat keeps Next.js native bindings (lightningcss / swc) happy on alpine
RUN apk add --no-cache libc6-compat

# Enable Corepack + pin pnpm version to match monorepo's packageManager field
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace manifest + lockfile + per-package package.json files for cached install.
# (These are the only files needed for `pnpm install` to resolve the workspace graph.)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/landing/package.json ./apps/landing/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/ui/package.json ./packages/ui/

# Install all workspace deps. Frozen lockfile guarantees reproducible builds.
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo. In dev, this layer is overridden by the
# `./:/repo` bind mount from docker-compose, so HMR picks up host edits.
COPY . .

EXPOSE 3000

# Dev: run next dev for the `web` workspace, bound to 0.0.0.0 so the host can reach it.
CMD ["pnpm", "--filter", "web", "dev", "--port", "3000", "--hostname", "0.0.0.0"]
