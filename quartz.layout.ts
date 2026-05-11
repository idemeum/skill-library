import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/idemeum/skills",
      Discord: "https://link.idemeum.com/discord",
      Docs: "https://docs.idemeum.com/",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.PageDescription(),
    Component.TagList(),
    Component.SkillMeta(),  // <-- after tags, before body
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      title: "Library",
      // Single explorer with `skills/` and `tools/` rendered as the two
      // top-level folder sections. Solves mobile: one hamburger, one overlay.
      filterFn: (node) =>
        node.slug.startsWith("skills/") || node.slug.startsWith("tools/"),
      // Pretty-print the folder names for display only.
      mapFn: (node) => {
        if (node.slugSegment === "skills") node.displayName = "Skills"
        if (node.slugSegment === "tools") node.displayName = "Tools"
      },
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.PageDescription()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      title: "Library",
      // Single explorer with `skills/` and `tools/` rendered as the two
      // top-level folder sections. Solves mobile: one hamburger, one overlay.
      filterFn: (node) =>
        node.slug.startsWith("skills/") || node.slug.startsWith("tools/"),
      // Pretty-print the folder names for display only.
      mapFn: (node) => {
        if (node.slugSegment === "skills") node.displayName = "Skills"
        if (node.slugSegment === "tools") node.displayName = "Tools"
      },
    }),
  ],
  right: [],
}
