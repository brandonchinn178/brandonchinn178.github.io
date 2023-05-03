#!/usr/bin/env bash

set -eux -o pipefail

LIVERELOAD_PORT=40004
JEKYLL_PORT=4000
CACHE_DIR=/tmp/brandonchinn178-gh-pages-cache

exec docker run --rm -it \
    --name 'brandonchinn178-gh-pages' \
    -p "${LIVERELOAD_PORT}:${LIVERELOAD_PORT}" \
    -p "${JEKYLL_PORT}:4000" \
    --volume="${PWD}:/srv/jekyll:Z" \
    --volume="${CACHE_DIR}:/usr/gem:Z" \
    jekyll/jekyll \
    jekyll serve \
        --livereload \
        --livereload-port "${LIVERELOAD_PORT}" \
        --future \
        --source docs/
