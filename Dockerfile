# syntax=docker/dockerfile:1
# Railway: monorepo frontend (CRA) + FastAPI backend, single service

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile --network-timeout 600000 || yarn install --network-timeout 600000; \
    elif [ -f package-lock.json ]; then npm ci || npm install; \
    else yarn install --network-timeout 600000; fi
COPY frontend/ ./
ENV CI=false
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV REACT_APP_BACKEND_URL=
RUN yarn build

FROM python:3.12-slim-bookworm
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/
COPY --from=frontend-build /frontend/build /app/static

EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
