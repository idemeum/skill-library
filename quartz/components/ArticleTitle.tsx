import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  if (!title) return null

  const isSkill = fileData.slug?.startsWith("skills/") ?? false
  const isTool = fileData.slug?.startsWith("tools/") ?? false

  return (
    <h1 class={classNames(displayClass, "article-title")}>
      <span class="article-title-text">{title}</span>
      {isSkill && (
        <span class="article-title-icon-wrapper" title="AI agent skill">
          <svg
            class="article-title-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 256 256"
            aria-label="AI agent skill"
            role="img"
          >
            <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"></path>
          </svg>
        </span>
      )}
      {isTool && (
        <span class="article-title-icon-wrapper" title="AI agent tool">
          <svg
            class="article-title-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 256 256"
            aria-label="AI agent tool"
            role="img"
          >
            <path d="M205.66,50.32a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32-11.31l56-56A8,8,0,0,1,205.66,50.32ZM248,58.41a50.13,50.13,0,0,1-14.77,35.66L180,147.3A15.86,15.86,0,0,1,168.69,152H152v16.83a16,16,0,0,1-3.25,9.66,8.08,8.08,0,0,1-.72.83l-8,8a16,16,0,0,1-22.62,0L98.7,168.6l-77,77.06a8,8,0,0,1-11.32-11.32l77.05-77.05-18.7-18.71a16,16,0,0,1,0-22.63l8-8a8,8,0,0,1,.82-.72A16.14,16.14,0,0,1,87.17,104H104V87.3A15.92,15.92,0,0,1,108.68,76l53.24-53.23A50.43,50.43,0,0,1,248,58.41Zm-16,0a34.43,34.43,0,0,0-58.77-24.35L120,87.3V104a16,16,0,0,1-16,16H87.28L80,127.27,128.72,176l7.28-7.28V152a16,16,0,0,1,16-16h16.69l53.23-53.24A34.21,34.21,0,0,0,232,58.41Z"></path>
          </svg>
        </span>
      )}
    </h1>
  )
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.article-title-icon-wrapper {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--dark);
}
.article-title-icon {
  flex-shrink: 0;
  width: 0.75em;
  height: 0.75em;
  color: var(--dark);
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
