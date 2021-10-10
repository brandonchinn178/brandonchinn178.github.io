#!/usr/bin/env bash

set -eux -o pipefail

builtin cd "$(dirname "${BASH_SOURCE[0]}")"

RUBY_PATH=(/usr/local/Cellar/ruby/*)

if [[ ! -d "${RUBY_PATH}" ]]; then
    echo "Install Ruby with brew" >&2
    exit 1
fi

# fix openssl for brew
export PKG_CONFIG_PATH=/usr/local/opt/openssl/lib/pkgconfig

export GEM_HOME=~/.ruby

exec "${RUBY_PATH}/bin/bundle" "$@"
