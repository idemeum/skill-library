import path from "path"
import fs from "fs"
import { VFile } from "vfile"
import { QuartzEmitterPlugin } from "../types"
import { FilePath, pathToRoot, slugifyFilePath } from "../../util/path"
import { glob } from "../../util/glob"
import { createMdProcessor, createHtmlProcessor } from "../../processors/parse"
import { pageResources, renderPage } from "../../components/renderPage"
import { write } from "./helpers"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { Root as MDRoot } from "remark-parse/lib"

export const TSCodePage: QuartzEmitterPlugin = () => {
  const layout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = layout
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "TSCodePage",

    getQuartzComponents() {
      return [
        Head, Header, Body,
        ...header, ...beforeBody, pageBody, ...afterBody, ...left, ...right,
        Footer,
      ]
    },

    async *emit(ctx, content, resources) {
      const { argv, cfg } = ctx
      const allFiles = content.map((c) => c[1].data)

      const tsFiles = await glob("**/*.ts", argv.directory, cfg.configuration.ignorePatterns)
      if (tsFiles.length === 0) return

      const mdProcessor = createMdProcessor(ctx)
      const htmlProcessor = createHtmlProcessor(ctx)

      for (const fp of tsFiles) {
        const fullPath = path.join(argv.directory, fp) as FilePath
        const source = fs.readFileSync(fullPath, "utf-8")
        const name = path.basename(fp, ".ts")

        // Wrap source in a fenced code block so Quartz renders it with Shiki
        const markdown = `# ${name}\n\n\`\`\`ts\n${source}\n\`\`\``

        // Build a VFile that looks like a normal content file to Quartz
        const file = new VFile({ value: markdown, path: fullPath })
        const relativePath = fp as FilePath
        // Place all TS pages under tools/ so they group in the Explorer sidebar
        const basename = path.basename(fp, ".ts")
        const slug = slugifyFilePath(`tools/${basename}.md` as FilePath)

        file.data.filePath = fullPath
        file.data.relativePath = relativePath
        file.data.slug = slug
        file.data.frontmatter = { title: name }

        // Run through the full MD → HTML pipeline (includes Shiki, transformers, etc.)
        const mdAst = mdProcessor.parse(file)
        const transformedMd = await mdProcessor.run(mdAst, file)
        const htmlAst = await htmlProcessor.run(transformedMd as MDRoot, file)

        // Render full page with Quartz layout
        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg: cfg.configuration,
          children: [],
          tree: htmlAst,
          allFiles,
        }

        const html = renderPage(cfg.configuration, slug, componentData, layout, externalResources)
        yield write({ ctx, content: html, slug, ext: ".html" })
      }
    },
  }
}
