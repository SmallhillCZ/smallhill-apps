#!/bin/bash
set -e

while read -r name port; do
  [ -n "$name" ] || continue
  prefix="$(echo "$name" | tr 'a-z-' 'A-Z_')_"
  (
    cd "/srv/apps/$name"
    while IFS='=' read -r key value; do
      if [[ $key == "$prefix"* ]]; then
        export "${key#"$prefix"}=$value"
      fi
    done < <(env)
    export PORT="$port" HOST=127.0.0.1 BASE_PATH="/$name/"
    exec npm run serve
  ) &
done < /srv/servers.list

nginx -g 'daemon off;' &

wait -n
exit 1
