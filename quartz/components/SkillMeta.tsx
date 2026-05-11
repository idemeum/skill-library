import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
// @ts-ignore
import script from "./scripts/skillmeta.inline"

interface SkillPill {
  label: string
  goal: string
  icon?: string
  iconClass?: string
  order?: number
}

interface SkillMetadata {
  prerequisites?: { "before-corrective"?: string[] }
  maxAggregateRisk?: "low" | "medium" | "high"
  affectedScope?: string | string[]
  userLabel?: string
  examples?: string[]
  pill?: SkillPill
}

interface SkillFrontmatter {
  name?: string
  description?: string
  "allowed-tools"?: string[]
  metadata?: SkillMetadata
  requiresConsent?: boolean
}

const RISK_STYLES: Record<string, { color: string; border: string; bg: string; label: string }> = {
  low:      { color: "#09ad7a", border: "#09ad7144", bg: "#09ad7110", label: "Low" },
  medium:   { color: "#dba642", border: "#dba64244", bg: "#dba64210", label: "Medium" },
  high:     { color: "#db8942", border: "#db894244", bg: "#db894210", label: "High" },
  critical: { color: "#d63838", border: "#d6383844", bg: "#d6383810", label: "Critical" },
}

export default ((() => {
const SkillMeta = ({ fileData }: QuartzComponentProps) => {
  const fm = fileData.frontmatter as SkillFrontmatter | undefined
  if (!fm) return null

  const meta = fm.metadata
  const tools = fm["allowed-tools"] ?? []
  const prereqs = meta?.prerequisites?.["before-corrective"] ?? []
  const riskStyle = RISK_STYLES[meta?.maxAggregateRisk ?? ""]
  const hasAffectedScope =
    !!meta?.affectedScope &&
    (Array.isArray(meta.affectedScope) ? meta.affectedScope.length > 0 : true)

  // Hide the section entirely if there's nothing meaningful to render
  // (title alone, which Quartz injects automatically, doesn't count).
  const hasContent =
    !!fm.name ||
    !!riskStyle ||
    fm.requiresConsent !== undefined ||
    hasAffectedScope ||
    !!meta?.pill ||
    !!meta?.userLabel ||
    (meta?.examples && meta.examples.length > 0) ||
    tools.length > 0 ||
    prereqs.length > 0
  if (!hasContent) return null

  // Tool pages live under tools/, skill pages under skills/
  const isTool = fileData.slug?.startsWith("tools/") ?? false
  const isSkill = fileData.slug?.startsWith("skills/") ?? false
  const sectionTitle = isTool ? "Metadata" : "Frontmatter"
  const sourceUrl = (fm as { sourceUrl?: string }).sourceUrl

  return (
    <>
      <h2>{sectionTitle}</h2>
      <div class="skill-meta" data-tools={JSON.stringify(tools)}>

      {/* Skill name */}
      {fm.name && (
        <div class="skill-section">
          <h4>Name</h4>
          <p class="skill-description">{fm.name}</p>
        </div>
      )}

      {/* Source — GitHub link (skill or tool pages) */}
      {(isSkill || isTool) && sourceUrl && (
        <div class="skill-section">
          <h4>Source</h4>
          <p class="skill-description">
            <a
              class="skill-source-link"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>GitHub source</span>
              <svg
                class="skill-source-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 256 256"
                aria-hidden="true"
              >
                <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z"></path>
              </svg>
            </a>
          </p>
        </div>
      )}

      {/* Risk */}
      {riskStyle && (
        <div class="skill-section">
          <h4>Risk</h4>
          <span
            class="skill-risk-badge"
            style={`color:${riskStyle.color};border-color:${riskStyle.border};background:${riskStyle.bg}`}
          >
            {riskStyle.label}
          </span>
        </div>
      )}

      {/* Requires consent */}
      {fm.requiresConsent !== undefined && (
        <div class="skill-section">
          <h4>Requires consent</h4>
          <span class="skill-badge">
            {fm.requiresConsent ? "true" : "false"}
          </span>
        </div>
      )}

      {/* Affected scope */}
      {meta?.affectedScope && (Array.isArray(meta.affectedScope) ? meta.affectedScope.length > 0 : true) && (
        <div class="skill-section">
          <h4>Affected scope</h4>
          <div class="skill-tools">
            {(Array.isArray(meta.affectedScope) ? meta.affectedScope : [meta.affectedScope]).map((s) => (
              <span class="skill-badge">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* What the user says to trigger this */}
      {meta?.userLabel && (
        <div class="skill-section">
          <h4>Trigger phrase</h4>
          <p class="skill-description">"{meta.userLabel}"</p>
        </div>
      )}

      {/* Example user phrases */}
      {meta?.examples && meta.examples.length > 0 && (
        <div class="skill-section">
          <h4>Example phrases</h4>
          <p class="skill-description">{meta.examples.map(ex => `"${ex}"`).join(", ")}</p>
        </div>
      )}

      {/* Allowed tools */}
      {tools.length > 0 && (
        <div class="skill-section">
          <h4>Allowed tools ({tools.length})</h4>
          <div class="skill-tools">
            {tools.map((t) => {
              const target = `tools/${t}` as FullSlug
              const href = fileData.slug
                ? resolveRelative(fileData.slug, target)
                : `/${target}`
              return (
                <a class="skill-tool-link" href={href} data-slug={target}>
                  <code class="skill-tool">{t}</code>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Prerequisites */}
      {prereqs.length > 0 && (
        <div class="skill-section">
          <h4>Prerequisites ({prereqs.length})</h4>
          <div class="skill-tools">
            {prereqs.map((p) => {
              const target = `tools/${p}` as FullSlug
              const href = fileData.slug
                ? resolveRelative(fileData.slug, target)
                : `/${target}`
              return (
                <a class="skill-tool-link" href={href} data-slug={target}>
                  <code class="skill-tool">{p}</code>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Pill preview — what shows in the agent UI (kept last in the box) */}
      {meta?.pill && (
        <div class="skill-section">
          <h4>Agent UI pill</h4>
          <span class="skill-badge">{meta.pill.label}</span>
        </div>
      )}

    </div>
    </>
  )
}

SkillMeta.css = `
.skill-meta {
  border: 1px solid var(--lightgray);
  border-radius: 8px;
  padding: 1.25rem;
  margin: 1rem 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.skill-badge {
  display: inline-block;
  font-size: 0.8em;
  font-weight: 600;
  font-family: var(--codeFont);
  padding: 0.25em 0.75em;
  border-radius: 4px;
  border: 1px solid var(--lightgray);
  background: var(--highlight);
  color: var(--darkgray);
}
.skill-risk-badge {
  display: inline-block;
  font-size: 0.8em;
  font-weight: 600;
  font-family: var(--codeFont);
  padding: 0.25em 0.75em;
  border-radius: 4px;
  border: 1px solid;
}
.skill-section h4 {
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray);
  margin: 0 0 0.5rem;
  border: none;
}
.skill-description {
  font-size: 0.9em;
  color: var(--darkgray);
  margin: 0;
  line-height: 1.6;
}
.skill-source-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}
.skill-source-icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}
.skill-user-label {
  font-style: italic;
  color: var(--dark);
  margin: 0;
}
.skill-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
/* Tool badge — looks identical in metadata and in body.
   "all: unset" strips every inherited and link property so the badge
   renders the same no matter what its parent is. We then re-declare only
   the box styling we want. */
/* The wrapping <a class="skill-tool-link"> stays fully transparent so only
   the inner <code class="skill-tool"> renders the badge. No background,
   border, padding, or link decoration on the <a>. */
a.skill-tool-link,
a.skill-tool-link:link,
a.skill-tool-link:hover,
a.skill-tool-link:visited,
a.skill-tool-link:focus,
a.skill-tool-link:active {
  background: none !important;
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  text-decoration: none !important;
  color: inherit !important;
  font-weight: inherit !important;
  box-shadow: none !important;
  outline: none !important;
  transition: none !important;
}

/* The visible badge — styled like a Quartz "note" callout (blue tones).
   Targets <code class="skill-tool"> in both the metadata box and the body. */
code.skill-tool,
code.skill-ref {
  display: inline-block;
  box-sizing: border-box;
  font-size: 0.8em;
  font-family: var(--codeFont);
  font-weight: 600;
  line-height: 1.4;
  padding: 0.25em 0.75em;
  border-radius: 5px;
  vertical-align: baseline;
}
code.skill-tool {
  border: 1px solid #448aff44;
  background: #448aff10;
  color: #448aff;
}
/* Skill references — Quartz "success" callout palette (green). */
code.skill-ref {
  border: 1px solid #09ad7144;
  background: #09ad7110;
  color: #09ad7a;
}
`

  SkillMeta.afterDOMLoaded = script
  return SkillMeta
}) satisfies QuartzComponentConstructor)