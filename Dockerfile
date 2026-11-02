FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY server-localhost.js server-allinterfaces.js ./

EXPOSE 3001 3002
