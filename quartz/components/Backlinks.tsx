import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { resolveRelative, simplifySlug } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import OverflowListFactory from "./OverflowList"

interface BacklinksOptions {
  hideWhenEmpty: boolean
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }
  const { OverflowList, overflowListAfterDOMLoaded } = OverflowListFactory()

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const slug = simplifySlug(fileData.slug!)
    const isTool = fileData.slug?.startsWith("tools/") ?? false
    const isSkill = fileData.slug?.startsWith("skills/") ?? false
    const outgoing = new Set(fileData.links ?? [])

    const renderSection = (title: string, files: typeof allFiles, key: string) => {
      if (options.hideWhenEmpty && files.length === 0) return null
      return (
        <div class={classNames(displayClass, "backlinks")} key={key}>
          <h3>{title}</h3>
          <OverflowList>
            {files.length > 0 ? (
              files.map((f) => (
                <li>
                  <a href={resolveRelative(fileData.slug!, f.slug!)} class="internal">
                    {f.frontmatter?.title}
                  </a>
                </li>
              ))
            ) : (
              <li>{i18n(cfg.locale).components.backlinks.noBacklinksFound}</li>
            )}
          </OverflowList>
        </div>
      )
    }

    // Skill pages get two separate outgoing-link sections:
    //   - "Tools used" — outgoing tool links
    //   - "References" — outgoing cross-skill links
    if (isSkill) {
      const toolFiles = allFiles.filter(
        (f) => f.slug?.startsWith("tools/") && outgoing.has(simplifySlug(f.slug)),
      )
      const skillFiles = allFiles.filter(
        (f) =>
          f.slug?.startsWith("skills/") &&
          f.slug !== fileData.slug &&
          outgoing.has(simplifySlug(f.slug)),
      )
      const tools = renderSection("Tools used", toolFiles, "tools-used")
      const refs = renderSection("References", skillFiles, "skill-refs")
      if (!tools && !refs) return null
      return (
        <>
          {tools}
          {refs}
        </>
      )
    }

    // Everywhere else (tools, index, etc.) the section shows incoming backlinks.
    const listFiles = allFiles.filter((file) => file.links?.includes(slug))
    const title = isTool
      ? "Skills using this tool"
      : i18n(cfg.locale).components.backlinks.title
    return renderSection(title, listFiles, "backlinks")
  }

  Backlinks.css = style
  Backlinks.afterDOMLoaded = overflowListAfterDOMLoaded

  return Backlinks
}) satisfies QuartzComponentConstructor
