# wise-timer — Vite SPA (dev = local 모드, runtime = prod 모드: GitHub Pages 와 동일한 하위 경로로 정적 서빙)
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

FROM base AS dev
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev"]

FROM dev AS build
# GitHub Pages 프로젝트 사이트 경로와 같게 빌드 (/<repo>/)
ARG VITE_BASE=/wise-Timer/
ENV VITE_BASE=$VITE_BASE
RUN pnpm build

FROM nginx:1.27-alpine AS runtime
ARG VITE_BASE=/wise-Timer/
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV APP_BASE=$VITE_BASE
COPY --from=build /app/dist /usr/share/nginx/html${VITE_BASE}
EXPOSE 8080
