FROM node:24-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY servers.conf /etc/nginx/smallhill-servers.conf
COPY html /usr/share/nginx/html
COPY servers /srv/apps
COPY servers.list entrypoint.sh /srv/
ARG VERSION
ENV VERSION=${VERSION} NODE_ENV=production
EXPOSE 80
CMD ["/srv/entrypoint.sh"]
