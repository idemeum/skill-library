import sourceMapSupport from "source-map-support"
sourceMapSupport.install(options)
import path from "path"
import { PerfTimer } from "./util/perf"
import { rm, mkdir, writeFile, readdir, unlink } from "fs/promises"
import { readFileSync } from "fs"
import { GlobbyFilterFunction, isGitIgnored } from "globby"
import { styleText } from "util"
import { parseMarkdown } from "./processors/parse"
import { filterContent } from "./processors/filter"
import { emitContent } from "./processors/emit"
import cfg from "../quartz.config"
import { FilePath, joinSegments, slugifyFilePath } from "./util/path"
import chokidar from "chokidar"
import { ProcessedContent } from "./plugins/vfile"
import { Argv, BuildCtx } from "./util/ctx"
import { glob, toPosixPath } from "./util/glob"
import { trace } from "./util/trace"
import { options } from "./util/sourcemap"
import { Mutex } from "async-mutex"
import { getStaticResourcesFromPlugins } from "./plugins"
import { randomIdNonSecure } from "./util/random"
import { ChangeEvent } from "./plugins/types"
import { minimatch } from "minimatch"
import { toolRisks } from "./util/toolRisks"

type ContentMap = Map<
  FilePath,
  | {
      type: "markdown"
      content: ProcessedContent
    }
  | {
      type: "other"
    }
>

type BuildData = {
  ctx: BuildCtx
  ignored: GlobbyFilterFunction
  mut: Mutex
  contentMap: ContentMap
  changesSinceLastBuild: Record<FilePath, ChangeEvent["type"]>
  lastBuildMs: number
}

async function buildQuartz(argv: Argv, mut: Mutex, clientRefresh: () => void) {
  const ctx: BuildCtx = {
    buildId: randomIdNonSecure(),
    argv,
    cfg,
    allSlugs: [],
    allFiles: [],
    incremental: false,
  }

  const perf = new PerfTimer()
  const output = argv.output

  const pluginCount = Object.values(cfg.plugins).flat().length
  const pluginNames = (key: "transformers" | "filters" | "emitters") =>
    cfg.plugins[key].map((plugin) => plugin.name)
  if (argv.verbose) {
    console.log(`Loaded ${pluginCount} plugins`)
    console.log(`  Transformers: ${pluginNames("transformers").join(", ")}`)
    console.log(`  Filters: ${pluginNames("filters").join(", ")}`)
    console.log(`  Emitters: ${pluginNames("emitters").join(", ")}`)
  }

  const release = await mut.acquire()
  perf.addEvent("clean")
  await rm(output, { recursive: true, force: true })
  console.log(`Cleaned output directory \`${output}\` in ${perf.timeSince("clean")}`)

  // Clean legacy tools/ subdirectory from previous builds
  await rm(joinSegments(argv.directory, "tools") as FilePath, { recursive: true, force: true })

  // GitHub repo backing `github-source/`. Used to render "View on GitHub"
  // links on each generated tool/skill page. Update branch or fork here.
  const SOURCE_REPO = {
    url: "https://github.com/idemeum/skills",
    branch: "main",
  }
  const sourceUrlFor = (relPath: string) =>
    `${SOURCE_REPO.url}/blob/${SOURCE_REPO.branch}/${relPath.split(path.sep).join("/")}`

  // Auto-generate a tool page for each .ts file. Source lives in the
  // sibling `github-source/` directory (synced from GitHub), and generated
  // pages are emitted into `<content>/tools/`.
  const sourceDir = path.join(path.dirname(argv.directory) || ".", "github-source")
  const tsFiles = await glob("**/*.ts", sourceDir, cfg.configuration.ignorePatterns)
  const tools = tsFiles.map((fp) => {
    const source = readFileSync(joinSegments(sourceDir, fp) as FilePath, "utf-8")
    const metaName = source.match(/export\s+const\s+meta\s*=\s*\{[^}]*?name:\s*["']([^"']+)["']/s)?.[1]
    const name = metaName ?? path.basename(fp, ".ts")

    // Extract description: join all quoted string parts after "description:"
    const descBlock = source.match(/description:\s*((?:"[^"]*"\s*(?:\+\s*)?)+)/s)?.[1]
    const description = descBlock
      ?.match(/"([^"]*)"/g)
      ?.map((s) => s.slice(1, -1))
      .join("")
      .trim()

    // Extract riskLevel
    const riskLevel = source.match(/riskLevel:\s*["']([^"']+)["']/)?.[1]

    // Extract affectedScope (array like ["user", "device"])
    const affectedScopeBlock = source.match(/affectedScope:\s*\[([^\]]*)\]/)?.[1]
    const affectedScope = affectedScopeBlock
      ?.match(/["']([^"']+)["']/g)
      ?.map((s) => s.slice(1, -1))

    // Extract requiresConsent boolean
    const requiresConsentMatch = source.match(/requiresConsent:\s*(true|false)/)
    const requiresConsent = requiresConsentMatch ? requiresConsentMatch[1] === "true" : undefined

    return {
      name,
      description,
      riskLevel,
      affectedScope,
      requiresConsent,
      source,
      sourceUrl: sourceUrlFor(fp),
    }
  })
  // Refresh the global risk map so SkillMeta and ToolLinks can colour
  // tool badges by risk in both the metadata box and the body.
  toolRisks.clear()
  for (const { name, riskLevel } of tools) {
    if (name && riskLevel) toolRisks.set(name, riskLevel)
  }
  const toolsDir = joinSegments(argv.directory, "tools") as FilePath
  await mkdir(toolsDir, { recursive: true })
  // Delete stale generated pages (root, skills/, and tools/ locations)
  await Promise.all(
    tools.flatMap(({ name }) => [
      unlink(joinSegments(argv.directory, `${name}.md`) as FilePath).catch(() => {}),
      unlink(joinSegments(argv.directory, "skills", `${name}.md`) as FilePath).catch(() => {}),
      unlink(joinSegments(toolsDir, `${name}.md`) as FilePath).catch(() => {}),
    ]),
  )
  for (const {
    name,
    description,
    riskLevel,
    affectedScope,
    requiresConsent,
    source,
    sourceUrl,
  } of tools) {
    let fm = `---\ntitle: ${name}\nname: ${name}\n`
    if (description) {
      const safe = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      fm += `description: "${safe}"\n`
    }
    if (riskLevel || (affectedScope && affectedScope.length > 0)) {
      fm += `metadata:\n`
      if (riskLevel) fm += `  maxAggregateRisk: ${riskLevel}\n`
      if (affectedScope && affectedScope.length > 0) {
        const safeScopes = affectedScope.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(", ")
        fm += `  affectedScope: [${safeScopes}]\n`
      }
    }
    if (requiresConsent !== undefined) {
      fm += `requiresConsent: ${requiresConsent}\n`
    }
    fm += `sourceUrl: ${sourceUrl}\n`
    fm += `---\n\n## Code\n\n\`\`\`ts\n${source}\n\`\`\``
    await writeFile(joinSegments(toolsDir, `${name}.md`) as FilePath, fm)
  }
  if (tools.length > 0) {
    console.log(`Generated ${tools.length} tool pages from .ts files`)
  }

  // Sync all .md files from github-source/ into <content>/skills/, preserving
  // folder structure. SKILL.md files are renamed to <frontmatter.name>.md;
  // every other .md keeps its original filename. We also rewrite any in-body
  // references to `<folder>/SKILL.md` so cross-skill links keep working after
  // the rename — otherwise the graph/backlinks would have broken edges.
  //
  // The whole `<content>/skills/` directory is wiped first so that any file
  // or folder removed from github-source/ is also removed from the site.
  const skillsDir = joinSegments(argv.directory, "skills") as FilePath
  await rm(skillsDir, { recursive: true, force: true })
  await mkdir(skillsDir, { recursive: true })
  const mdSourceFiles = await glob("**/*.md", sourceDir, cfg.configuration.ignorePatterns)

  // Pass 1: for every SKILL.md file, learn its folder → frontmatter.name mapping
  // so we can rewrite cross-skill references in pass 2.
  const folderToSkillName = new Map<string, string>()
  for (const fp of mdSourceFiles) {
    if (path.basename(fp) !== "SKILL.md") continue
    const content = readFileSync(joinSegments(sourceDir, fp) as FilePath, "utf-8")
    const fmBlock = content.match(/^---\s*\n([\s\S]*?)\n---/)?.[1]
    const nameMatch = fmBlock?.match(/^name:\s*["']?([^"'\n]+?)["']?\s*$/m)
    const skillName = nameMatch?.[1].trim()
    if (skillName) {
      const folder = path.dirname(fp)
      folderToSkillName.set(folder, skillName)
    }
  }

  // Pass 2: write files, rewriting any `(...folder/SKILL.md)` references.
  let skillCount = 0
  for (const fp of mdSourceFiles) {
    const base = path.basename(fp)
    if (base.toLowerCase() === "readme.md") continue

    let fileContent = readFileSync(joinSegments(sourceDir, fp) as FilePath, "utf-8")
    const dir = path.dirname(fp)

    // Rewrite cross-skill SKILL.md references to <skill-name>.md so they
    // resolve correctly after rename. Handles relative paths like
    // ../other-skill/SKILL.md and ./SKILL.md.
    fileContent = fileContent.replace(
      /(\]\(|<)([^)<>\s]*?)([^/)<>\s]+)\/SKILL(\.md)?(\)|>|#|\s)/g,
      (match, opener, prefix, folder, ext, closer) => {
        const rename = folderToSkillName.get(folder)
        if (!rename) return match
        return `${opener}${prefix}${folder}/${rename}${ext ?? ""}${closer}`
      },
    )

    let targetName = base
    if (base === "SKILL.md") {
      const skillName = folderToSkillName.get(dir)
      if (skillName) {
        targetName = `${skillName}.md`
      }
    }

    // Inject sourceUrl into the frontmatter so ArticleTitle can render the
    // "View on GitHub" icon. If there's no frontmatter block, create one.
    const sourceUrl = sourceUrlFor(fp)
    if (/^---\s*\n[\s\S]*?\n---/.test(fileContent)) {
      fileContent = fileContent.replace(
        /^(---\s*\n[\s\S]*?)(\n---)/,
        (_m, head, tail) => `${head}\nsourceUrl: ${sourceUrl}${tail}`,
      )
    } else {
      fileContent = `---\nsourceUrl: ${sourceUrl}\n---\n\n${fileContent}`
    }

    const targetDir =
      dir === "." ? skillsDir : (joinSegments(skillsDir, dir) as FilePath)
    await mkdir(targetDir, { recursive: true })
    await writeFile(joinSegments(targetDir, targetName) as FilePath, fileContent)
    skillCount++
  }
  if (skillCount > 0) {
    console.log(`Synced ${skillCount} skill pages from github-source/`)
  }

  perf.addEvent("glob")
  const allFiles = await glob("**/*.*", argv.directory, cfg.configuration.ignorePatterns)
  const markdownPaths = allFiles.filter((fp) => fp.endsWith(".md")).sort()
  console.log(
    `Found ${markdownPaths.length} input files from \`${argv.directory}\` in ${perf.timeSince("glob")}`,
  )

  const filePaths = markdownPaths.map((fp) => joinSegments(argv.directory, fp) as FilePath)
  ctx.allFiles = allFiles
  ctx.allSlugs = allFiles.map((fp) => slugifyFilePath(fp as FilePath))

  const parsedFiles = await parseMarkdown(ctx, filePaths)
  const filteredContent = filterContent(ctx, parsedFiles)

  await emitContent(ctx, filteredContent)
  console.log(
    styleText("green", `Done processing ${markdownPaths.length} files in ${perf.timeSince()}`),
  )
  release()

  if (argv.watch) {
    ctx.incremental = true
    return startWatching(ctx, mut, parsedFiles, clientRefresh)
  }
}

// setup watcher for rebuilds
async function startWatching(
  ctx: BuildCtx,
  mut: Mutex,
  initialContent: ProcessedContent[],
  clientRefresh: () => void,
) {
  const { argv, allFiles } = ctx

  const contentMap: ContentMap = new Map()
  for (const filePath of allFiles) {
    contentMap.set(filePath, {
      type: "other",
    })
  }

  for (const content of initialContent) {
    const [_tree, vfile] = content
    contentMap.set(vfile.data.relativePath!, {
      type: "markdown",
      content,
    })
  }

  const gitIgnoredMatcher = await isGitIgnored()
  const buildData: BuildData = {
    ctx,
    mut,
    contentMap,
    ignored: (fp) => {
      const pathStr = toPosixPath(fp.toString())
      if (pathStr.startsWith(".git/")) return true
      if (gitIgnoredMatcher(pathStr)) return true
      for (const pattern of cfg.configuration.ignorePatterns) {
        if (minimatch(pathStr, pattern)) {
          return true
        }
      }

      return false
    },

    changesSinceLastBuild: {},
    lastBuildMs: 0,
  }

  const watcher = chokidar.watch(".", {
    awaitWriteFinish: { stabilityThreshold: 250 },
    persistent: true,
    cwd: argv.directory,
    ignoreInitial: true,
  })

  const changes: ChangeEvent[] = []
  watcher
    .on("add", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "add" })
      void rebuild(changes, clientRefresh, buildData)
    })
    .on("change", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "change" })
      void rebuild(changes, clientRefresh, buildData)
    })
    .on("unlink", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "delete" })
      void rebuild(changes, clientRefresh, buildData)
    })

  return async () => {
    await watcher.close()
  }
}

async function rebuild(changes: ChangeEvent[], clientRefresh: () => void, buildData: BuildData) {
  const { ctx, contentMap, mut, changesSinceLastBuild } = buildData
  const { argv, cfg } = ctx

  const buildId = randomIdNonSecure()
  ctx.buildId = buildId
  buildData.lastBuildMs = new Date().getTime()
  const numChangesInBuild = changes.length
  const release = await mut.acquire()

  // if there's another build after us, release and let them do it
  if (ctx.buildId !== buildId) {
    release()
    return
  }

  const perf = new PerfTimer()
  perf.addEvent("rebuild")
  console.log(styleText("yellow", "Detected change, rebuilding..."))

  // update changesSinceLastBuild
  for (const change of changes) {
    changesSinceLastBuild[change.path] = change.type
  }

  const staticResources = getStaticResourcesFromPlugins(ctx)
  const pathsToParse: FilePath[] = []
  for (const [fp, type] of Object.entries(changesSinceLastBuild)) {
    if (type === "delete" || path.extname(fp) !== ".md") continue
    const fullPath = joinSegments(argv.directory, toPosixPath(fp)) as FilePath
    pathsToParse.push(fullPath)
  }

  const parsed = await parseMarkdown(ctx, pathsToParse)
  for (const content of parsed) {
    contentMap.set(content[1].data.relativePath!, {
      type: "markdown",
      content,
    })
  }

  // update state using changesSinceLastBuild
  // we do this weird play of add => compute change events => remove
  // so that partialEmitters can do appropriate cleanup based on the content of deleted files
  for (const [file, change] of Object.entries(changesSinceLastBuild)) {
    if (change === "delete") {
      // universal delete case
      contentMap.delete(file as FilePath)
    }

    // manually track non-markdown files as processed files only
    // contains markdown files
    if (change === "add" && path.extname(file) !== ".md") {
      contentMap.set(file as FilePath, {
        type: "other",
      })
    }
  }

  const changeEvents: ChangeEvent[] = Object.entries(changesSinceLastBuild).map(([fp, type]) => {
    const path = fp as FilePath
    const processedContent = contentMap.get(path)
    if (processedContent?.type === "markdown") {
      const [_tree, file] = processedContent.content
      return {
        type,
        path,
        file,
      }
    }

    return {
      type,
      path,
    }
  })

  // update allFiles and then allSlugs with the consistent view of content map
  ctx.allFiles = Array.from(contentMap.keys())
  ctx.allSlugs = ctx.allFiles.map((fp) => slugifyFilePath(fp as FilePath))
  let processedFiles = filterContent(
    ctx,
    Array.from(contentMap.values())
      .filter((file) => file.type === "markdown")
      .map((file) => file.content),
  )

  let emittedFiles = 0
  for (const emitter of cfg.plugins.emitters) {
    // Try to use partialEmit if available, otherwise assume the output is static
    const emitFn = emitter.partialEmit ?? emitter.emit
    const emitted = await emitFn(ctx, processedFiles, staticResources, changeEvents)
    if (emitted === null) {
      continue
    }

    if (Symbol.asyncIterator in emitted) {
      // Async generator case
      for await (const file of emitted) {
        emittedFiles++
        if (ctx.argv.verbose) {
          console.log(`[emit:${emitter.name}] ${file}`)
        }
      }
    } else {
      // Array case
      emittedFiles += emitted.length
      if (ctx.argv.verbose) {
        for (const file of emitted) {
          console.log(`[emit:${emitter.name}] ${file}`)
        }
      }
    }
  }

  console.log(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince("rebuild")}`)
  console.log(styleText("green", `Done rebuilding in ${perf.timeSince()}`))
  changes.splice(0, numChangesInBuild)
  clientRefresh()
  release()
}

export default async (argv: Argv, mut: Mutex, clientRefresh: () => void) => {
  try {
    return await buildQuartz(argv, mut, clientRefresh)
  } catch (err) {
    trace("\nExiting Quartz due to a fatal error", err as Error)
  }
}
