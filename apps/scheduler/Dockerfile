# Builds the Angular PWA, then runs the server, which also serves it under BASE_PATH.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
ARG BASE_PATH=/scheduler/
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --base-href "$BASE_PATH"

FROM node:${NODE_VERSION}-alpine
ARG BASE_PATH=/scheduler/
ARG VERSION
ENV NODE_ENV=production PORT=3000 BASE_PATH=$BASE_PATH WEB_ROOT=/app/public VERSION=$VERSION
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist/scheduler/browser ./public
USER node
EXPOSE 3000
CMD ["node", "server/server.ts"]
