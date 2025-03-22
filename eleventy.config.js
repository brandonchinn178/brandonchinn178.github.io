import mdFootnote from "markdown-it-footnote"
import mdHighlight from "markdown-it-highlightjs"

export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("resources")

  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.use(mdFootnote)
    mdLib.use(mdHighlight)
  })

  eleventyConfig.addShortcode("excerpt", function(post) {
    const content = post.templateContent
    const start = content.toLowerCase().indexOf('<p>');
    const end = content.toLowerCase().indexOf('</p>');
    return content.substring(start + 3, end);
  })

  eleventyConfig.addFilter("utcDate", function(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(value)
  })
}
