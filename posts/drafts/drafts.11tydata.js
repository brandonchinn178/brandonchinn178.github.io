export default {
  draft: true,
  permalink: function ({ page }) {
    return `/posts/__/${page.fileSlug}/`
  },
}
