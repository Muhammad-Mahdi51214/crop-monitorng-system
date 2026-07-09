# AgroAI API — Express + Python satellite worker (Render / Fly / any Docker host)
FROM node:20-bookworm-slim AS build

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend ./
RUN npm run build

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist/
COPY backend/sql ./backend/sql/
COPY python-worker ./python-worker/

WORKDIR /app/backend
RUN npm ci --omit=dev
RUN pip3 install --no-cache-dir --break-system-packages -r ../python-worker/requirements.txt

ENV NODE_ENV=production
ENV PYTHON_PATH=python3

EXPOSE 8000

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
