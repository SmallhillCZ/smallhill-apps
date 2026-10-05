#!/bin/bash
set -e

while read -r name port; do
  [ -n "$name" ] || continue
  (
    cd "/srv/apps/$name"
    export PORT="$port" HOST=127.0.0.1 BASE_PATH="/$name/"
    exec npm run serve
  ) &
done < /srv/servers.list

nginx -g 'daemon off;' &

wait -n
exit 1
