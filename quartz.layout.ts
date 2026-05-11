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
      title: "Skills",
      startPath: "skills",
      filterFn: (node) => node.slug.startsWith("skills/"),
    }),
    Component.Explorer({
      title: "Tools",
      startCollapsed: true,
      startPath: "tools",
      filterFn: (node) => node.slug.startsWith("tools/"),
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
      title: "Skills",
      startPath: "skills",
      filterFn: (node) => node.slug.startsWith("skills/"),
    }),
    Component.Explorer({
      title: "Tools",
      startCollapsed: true,
      startPath: "tools",
      filterFn: (node) => node.slug.startsWith("tools/"),
    }),
  ],
  right: [],
}
