FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends iproute2 curl procps \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY server.js ./

CMD ["node", "server.js"]
