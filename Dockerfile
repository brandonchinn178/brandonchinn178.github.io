# https://pages.github.com/versions/
ARG RUBY_VERSION=3.3.4
ARG GITHUB_GEM_VERSION=232

FROM ruby:${RUBY_VERSION}

WORKDIR /src

ARG GITHUB_GEM_VERSION
RUN gem install --verbose --no-document \
    github-pages -v ${GITHUB_GEM_VERSION}
