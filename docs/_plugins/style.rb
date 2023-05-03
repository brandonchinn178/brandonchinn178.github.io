module Jekyll
  class StyleTag < Liquid::Tag

    def initialize(tag_name, file, tokens)
      super
      @file = file
    end

    def render(context)
      "<link rel=\"stylesheet\" type=\"text/css\" href=\"/resources/#{@file}\">"
    end
  end
end

Liquid::Template.register_tag('style', Jekyll::StyleTag)
