import { QuartzTransformerPlugin } from "../types"
import {
  FullSlug,
  SimpleSlug,
  joinSegments,
  pathToRoot,
  simplifySlug,
} from "../../util/path"
import { visit } from "unist-util-visit"
import { Element, Root, Text } from "hast"
import { toolRisks, riskClass } from "../../util/toolRisks"

/**
 * Rewrites inline `<code>tool_name</code>` mentions into anchor links to the
 * matching page under `tools/`, and also registers every referenced tool as
 * an outgoing link on `file.data.links` so the backlinks/graph view shows
 * the skill → tool connections.
 *
 * Sources of tool references on a skill page:
 *   1. Body: inline `<code>` whose text exactly matches a known tool slug
 *   2. Frontmatter: `allowed-tools` and `metadata.prerequisites.before-corrective`
 */
export const ToolLinks: QuartzTransformerPlugin = () => {
  return {
    name: "ToolLinks",
    htmlPlugins(ctx) {
      return [
        () => {
          const toolNames = new Set<string>()
          const skillSlugSet = new Set<string>()
          // skill basename → full slug (for matching backtick mentions)
          const skillNameToSlug = new Map<string, FullSlug>()
          for (const slug of ctx.allSlugs) {
            if (slug.startsWith("tools/")) {
              const name = slug.slice("tools/".length)
              if (name && !name.includes("/")) {
                toolNames.add(name)
              }
            } else if (slug.startsWith("skills/")) {
              skillSlugSet.add(slug)
              // Use the basename (last segment) as the canonical skill name.
              // For our layout that's e.g. "skills/process-manager/process-manager"
              // → basename "process-manager".
              const parts = slug.split("/")
              const base = parts[parts.length - 1]
              if (base && !skillNameToSlug.has(base)) {
                skillNameToSlug.set(base, slug)
              }
            }
          }
          // `markdownLinkResolution: "shortest"` in CrawlLinks can strip the
          // leading `skills/` from data-slug on cross-skill anchors. Recognise
          // both the full form and any data-slug that becomes a skill when
          // we re-add the `skills/` prefix.
          const isSkillSlug = (s: string) =>
            skillSlugSet.has(s) || skillSlugSet.has(`skills/${s}`)
          // Same trick for tool anchors: data-slug may be "tools/foo" or just "foo".
          const toolNameForSlug = (s: string): string | undefined => {
            if (s.startsWith("tools/")) {
              const n = s.slice("tools/".length)
              return toolNames.has(n) ? n : undefined
            }
            return toolNames.has(s) ? s : undefined
          }

          return (tree: Root, file) => {
            const curSlug = file.data.slug as FullSlug | undefined
            if (!curSlug) return
            // Skip auto-generated tool pages — they shouldn't have their
            // own description/body text auto-badged.
            if (curSlug.startsWith("tools/")) return
            if (toolNames.size === 0 && skillSlugSet.size === 0) return

            const root = pathToRoot(curSlug)
            const referenced = new Set<string>()
            // Cross-skill outgoing slugs (FullSlug) collected from body links.
            const referencedSkills = new Set<FullSlug>()

            // 1) Body pass: handle two kinds of references
            //    a. inline <code>tool_name</code> → wrap with <a><code class="skill-tool">
            //    b. <a data-slug="skills/…"> from regular markdown links →
            //       restyle as the same badge so skill→skill refs look like tool refs
            visit(tree, "element", (node: Element, index, parent) => {
              // (a) Inline code matching a known tool OR a known skill name
              if (node.tagName === "code") {
                if (
                  parent &&
                  "tagName" in parent &&
                  (parent as Element).tagName === "pre"
                ) {
                  return
                }
                if (node.children.length !== 1) return
                const child = node.children[0]
                if (child.type !== "text") return
                const value = (child as Text).value.trim()

                // Tool badge — colour the badge by the tool's riskLevel
                if (toolNames.has(value)) {
                  const target = `tools/${value}` as FullSlug
                  const href = joinSegments(root, simplifySlug(target))
                  referenced.add(value)

                  const codeClasses = ["skill-tool"]
                  const rc = riskClass(toolRisks.get(value))
                  if (rc) codeClasses.push(rc)

                  const anchor: Element = {
                    type: "element",
                    tagName: "a",
                    properties: {
                      href,
                      "data-slug": target,
                      className: ["skill-tool-link"],
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "code",
                        properties: { className: codeClasses },
                        children: [{ type: "text", value }],
                      },
                    ],
                  }
                  if (parent && typeof index === "number") {
                    parent.children[index] = anchor
                  }
                  return
                }

                // Skill badge (green) — skip self-references
                const targetSkill = skillNameToSlug.get(value)
                if (targetSkill && targetSkill !== curSlug) {
                  const href = joinSegments(root, simplifySlug(targetSkill))
                  referencedSkills.add(targetSkill)

                  const anchor: Element = {
                    type: "element",
                    tagName: "a",
                    properties: {
                      href,
                      "data-slug": targetSkill,
                      className: ["skill-tool-link"],
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "code",
                        properties: { className: ["skill-ref"] },
                        children: [{ type: "text", value }],
                      },
                    ],
                  }
                  if (parent && typeof index === "number") {
                    parent.children[index] = anchor
                  }
                  return
                }
                return
              }

              // (b/c) Cross-skill or tool anchor written as a regular
              // markdown link. CrawlLinks has already set data-slug on
              // internal <a> tags. Two cases are handled below — skill (b)
              // and tool (c) — depending on what the data-slug points to.
              if (node.tagName !== "a") return
              const props = node.properties ?? {}
              const dataSlug = props["data-slug"]
              if (typeof dataSlug !== "string") return

              // Skip if we've already wrapped this anchor (idempotent re-visit guard).
              const classes = (props.className as string[] | undefined) ?? []
              if (classes.includes("skill-tool-link")) return

              // Only badge anchors with a single text child — leave anything
              // with complex inner content (images, formatting) alone.
              if (
                node.children.length !== 1 ||
                node.children[0].type !== "text"
              ) {
                return
              }
              const anchorText = (node.children[0] as Text).value

              // (c) Tool anchor: rewrite as a blue/risk-colored tool badge.
              const toolName = toolNameForSlug(dataSlug)
              if (toolName) {
                const target = `tools/${toolName}` as FullSlug
                if (target === curSlug) return // self-link, skip

                const correctHref = joinSegments(root, simplifySlug(target))
                referenced.add(toolName)

                const codeClasses = ["skill-tool"]
                const rc = riskClass(toolRisks.get(toolName))
                if (rc) codeClasses.push(rc)

                node.properties = {
                  ...props,
                  href: correctHref,
                  "data-slug": target,
                  className: [
                    ...classes.filter((c) => c !== "internal"),
                    "skill-tool-link",
                  ],
                }
                node.children = [
                  {
                    type: "element",
                    tagName: "code",
                    properties: { className: codeClasses },
                    children: [{ type: "text", value: anchorText }],
                  },
                ]
                return
              }

              // (b) Skill anchor
              if (!isSkillSlug(dataSlug)) return
              // Resolve to the full skill slug so the href is correct
              // regardless of what CrawlLinks' "shortest" mode produced.
              const fullTarget = (
                dataSlug.startsWith("skills/") ? dataSlug : `skills/${dataSlug}`
              ) as FullSlug
              if (fullTarget === curSlug) return // self-link, skip

              // Recompute href against the full target slug. Quartz's
              // "shortest" mode sometimes produces a broken relative href for
              // ../ markdown links (e.g. ../.././x/y resolves to /x/y, missing
              // the skills/ prefix), which breaks navigation and popover.
              const correctHref = joinSegments(root, simplifySlug(fullTarget))
              referencedSkills.add(fullTarget)

              node.properties = {
                ...props,
                href: correctHref,
                "data-slug": fullTarget,
                className: [...classes.filter((c) => c !== "internal"), "skill-tool-link"],
              }
              node.children = [
                {
                  type: "element",
                  tagName: "code",
                  // `skill-ref` styles the badge with the Quartz "quote"
                  // callout palette — distinguishes skill references from
                  // tool references (blue "note" callout).
                  properties: { className: ["skill-ref"] },
                  children: [{ type: "text", value: anchorText }],
                },
              ]
            })

            // 2) Frontmatter: allowed-tools + prerequisites.before-corrective
            const fm = file.data.frontmatter as Record<string, unknown> | undefined
            const fmList = (v: unknown): string[] =>
              Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
            const allowed = fmList(fm?.["allowed-tools"])
            const meta = fm?.metadata as Record<string, unknown> | undefined
            const prereqs = fmList(
              (meta?.prerequisites as Record<string, unknown> | undefined)?.[
                "before-corrective"
              ],
            )
            for (const t of [...allowed, ...prereqs]) {
              if (toolNames.has(t)) referenced.add(t)
            }

            // Merge into file.data.links so backlinks/graph pick it up.
            // - Add tool slugs from body/frontmatter references.
            // - Add full-form skill slugs from cross-skill body references.
            // - Drop any short-form skill slugs CrawlLinks stored (e.g.
            //   "foo/foo" without the "skills/" prefix) so the graph's
            //   validity check matches them against contentIndex keys.
            const existing = new Set<SimpleSlug>(file.data.links ?? [])
            for (const name of referenced) {
              existing.add(simplifySlug(`tools/${name}` as FullSlug))
            }
            for (const fullSkill of referencedSkills) {
              existing.add(simplifySlug(fullSkill))
              // Remove the shortened variant (everything after `skills/`) that
              // CrawlLinks may have inserted.
              const short = fullSkill.slice("skills/".length)
              existing.delete(short as SimpleSlug)
            }
            file.data.links = [...existing]
          }
        },
      ]
    },
  }
}
