FROM oven/bun:1.3.10 AS app

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=3000
ENV CATALOG_DB_PATH=/app/data/catalog.db
ARG BETTER_AUTH_SECRET
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

COPY . .
RUN bunx --bun next build
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["bunx", "--bun", "next", "start"]
