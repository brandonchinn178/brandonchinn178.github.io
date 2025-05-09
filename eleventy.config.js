import mdFootnote from "markdown-it-footnote"
import mdHighlight from "markdown-it-highlightjs"
import striptags from "striptags"

export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("resources")

  eleventyConfig.addPreprocessor("drafts", "*", (data, content) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") {
      return false
    }
  })

  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.use(mdFootnote)
    mdLib.use(mdHighlight)
  })

  eleventyConfig.addFilter("excerpt", function(post) {
    const content = post.templateContent

    const excerptTag = content.indexOf("<!-- excerpt -->")
    if (excerptTag !== -1) {
      return content.substring(0, excerptTag)
    }

    const start = content.toLowerCase().indexOf('<p>');
    const end = content.toLowerCase().indexOf('</p>');
    return content.substring(start + 3, end);
  })

  eleventyConfig.addFilter("striptags", striptags)

  eleventyConfig.addFilter("utcDate", function(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(value)
  })
}
