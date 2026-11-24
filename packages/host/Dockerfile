# syntax=docker/dockerfile:1
# One image for every service (docs/azure/prd.md, "Stack": multi-stage, distroless Node).
# SERVICES picks what a container hosts. Build from the repository root:
#   docker build -f packages/host/Dockerfile -t ghcr.io/skilient/services:<commit> .

FROM node:22.22.0-bookworm-slim AS build
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter "@skilient/host..." \
 && pnpm --filter @skilient/host bundle

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build /src/packages/host/dist/ ./
ENV NODE_ENV=production PORT=8080 HTTP1_PORT=8081
EXPOSE 8080 8081
CMD ["--enable-source-maps", "host.mjs"]
