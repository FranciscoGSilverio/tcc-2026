FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git make openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN make setup && npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:../data/app.db \
    LOG_LEVEL=info

EXPOSE 3000

CMD ["node", "dist/server.js"]
