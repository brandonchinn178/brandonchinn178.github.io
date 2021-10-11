#!/usr/bin/env bash

set -eux -o pipefail

LIVERELOAD_PORT=40004
JEKYLL_PORT=4000

docker run --rm -it \
    -v "${PWD}:/srv/jekyll" \
    -p "${LIVERELOAD_PORT}:${LIVERELOAD_PORT}" \
    -p "${JEKYLL_PORT}:4000" \
    jekyll/jekyll \
    jekyll serve --livereload --livereload-port "${LIVERELOAD_PORT}"
