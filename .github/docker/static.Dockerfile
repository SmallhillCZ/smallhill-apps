ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build && mkdir -p /out && cp -r dist/*/browser/. /out/

FROM nginx:alpine
ARG BASE_PATH=/
ARG VERSION
ENV VERSION=${VERSION}
RUN rm -rf /usr/share/nginx/html/* && printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  include /etc/nginx/mime.types;' \
  '  types { application/manifest+json webmanifest; }' \
  '  root /usr/share/nginx/html;' \
  "  location ${BASE_PATH} {" \
  "    try_files \$uri \$uri/ ${BASE_PATH}index.html;" \
  '  }' \
  "  location ~ ^${BASE_PATH}(index\\.html|ngsw\\.json|ngsw-worker\\.js|manifest\\.webmanifest)\$ {" \
  "    add_header Cache-Control \"no-cache\";" \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
