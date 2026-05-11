import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { Root, Text } from "hast"

/**
 * Replaces placeholder tokens in any page's body with live counts derived
 * from the site's content tree:
 *
 *   {{tools-count}}  → number of .md pages under `tools/`
 *   {{skills-count}} → number of distinct top-level folders under `skills/`
 *                      (each folder == one skill, matches our build layout)
 */
export const ContentCounts: QuartzTransformerPlugin = () => {
  return {
    name: "ContentCounts",
    htmlPlugins(ctx) {
      return [
        () => {
          let toolsCount = 0
          const skillFolders = new Set<string>()
          for (const slug of ctx.allSlugs) {
            if (slug.startsWith("tools/")) {
              const rest = slug.slice("tools/".length)
              if (rest && !rest.endsWith("/index")) toolsCount++
            } else if (slug.startsWith("skills/")) {
              const rest = slug.slice("skills/".length)
              const folder = rest.split("/")[0]
              if (folder) skillFolders.add(folder)
            }
          }
          const skillsCount = skillFolders.size

          const replacements: Record<string, string> = {
            "{{tools-count}}": String(toolsCount),
            "{{skills-count}}": String(skillsCount),
          }
          const re = /\{\{(?:tools-count|skills-count)\}\}/g

          return (tree: Root) => {
            visit(tree, "text", (node: Text) => {
              if (!re.test(node.value)) return
              re.lastIndex = 0
              node.value = node.value.replace(re, (m) => replacements[m] ?? m)
            })
          }
        },
      ]
    },
  }
}
