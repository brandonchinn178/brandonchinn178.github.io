FROM ubuntu:jammy

ENV LC_ALL=C.UTF-8

# install system dependencies
RUN apt-get update \
    && apt-get install -y git curl \
    && apt-get install -y autoconf bison patch build-essential rustc libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libgmp-dev libncurses5-dev libffi-dev libgdbm6 libgdbm-dev libdb-dev uuid-dev

# set up user
ENV HOME=/home/brandon
RUN adduser brandon --home ${HOME}
USER brandon

# https://pages.github.com/versions/
ENV RUBY_VERSION=2.7.4

# install ruby
RUN git clone https://github.com/rbenv/rbenv.git ~/.rbenv \
    && git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
ENV PATH=${HOME}/.rbenv/bin:${HOME}/.rbenv/shims:$PATH
RUN rbenv install ${RUBY_VERSION} \
    && rbenv global ${RUBY_VERSION}

# install bundler
RUN gem install bundler

# install deps
WORKDIR /src
COPY Gemfile Gemfile.lock .
RUN bundle install
