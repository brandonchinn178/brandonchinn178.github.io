export default {
  layout: "post.html",
  tags: ["post"],
  permalink: function ({ page }) {
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).formatToParts(page.date)
    const y = parts[4].value
    const m = parts[0].value
    const d = parts[2].value

    return `/posts/${y}/${m}/${d}/${page.fileSlug}/`
  },
}
