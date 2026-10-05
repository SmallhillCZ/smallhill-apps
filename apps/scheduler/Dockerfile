# Builds the Angular PWA, then runs the server, which also serves it under BASE_PATH.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 BASE_PATH=/scheduler WEB_ROOT=/app/public
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist/scheduler/browser ./public
USER node
EXPOSE 3000
CMD ["node", "server/server.ts"]
