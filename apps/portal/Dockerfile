FROM nginx:alpine
ARG VERSION
ENV VERSION=${VERSION}
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html /usr/share/nginx/html
EXPOSE 80
