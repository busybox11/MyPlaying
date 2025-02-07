FROM oven/bun:latest

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

CMD ["bun", "run", "start"]