#!/usr/bin/env bash

set -eux -o pipefail

builtin cd "$(dirname "${BASH_SOURCE[0]}")"

RUBY_PATH=(/usr/local/Cellar/ruby/*/bin)

if [[ ! -d "${RUBY_PATH}" ]]; then
    echo "Install Ruby with brew" >&2
    exit 1
fi

export GEM_PATH=~/.ruby
export PATH="${GEM_PATH}/bin:${RUBY_PATH}:${PATH}"

gem install --install-dir "${GEM_PATH}" jekyll
jekyll serve "$@"
