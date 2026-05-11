import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const PageDescription: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const description = fileData.frontmatter?.description
  if (!description) return null
  return (
    <p class={classNames(displayClass, "page-description")}>{description}</p>
  )
}

PageDescription.css = `
.page-description {
  color: var(--darkgray);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0.5rem 0 1rem;
}
`

export default (() => PageDescription) satisfies QuartzComponentConstructor
