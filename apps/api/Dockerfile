FROM node:20-slim AS base
WORKDIR /app

# Copy all manifests so npm workspaces can resolve the graph
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# ---- builder: install all deps + compile ----
FROM base AS builder
# Install all workspace deps (includes devDeps for build)
RUN npm install --workspaces --include-workspace-root
# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
# Build shared types then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ---- runner: lean production image ----
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser

# Copy only what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

RUN mkdir -p /tmp/converter-jobs && chown apiuser:nodejs /tmp/converter-jobs

USER apiuser

EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
