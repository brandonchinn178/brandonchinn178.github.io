#!/usr/bin/env bash

set -eux -o pipefail

LIVERELOAD_PORT=40004
JEKYLL_PORT=4000

docker build -t brandonchinn178-gh-pages .
exec docker run --rm -it \
    --name brandonchinn178-gh-pages \
    -p "${LIVERELOAD_PORT}:${LIVERELOAD_PORT}" \
    -p "${JEKYLL_PORT}:${JEKYLL_PORT}" \
    --volume="${PWD}:/src" \
    brandonchinn178-gh-pages \
    bundle exec jekyll serve \
        --host 0.0.0.0 \
        --port ${JEKYLL_PORT} \
        --livereload \
        --livereload-port "${LIVERELOAD_PORT}" \
        --future \
        --source docs/
