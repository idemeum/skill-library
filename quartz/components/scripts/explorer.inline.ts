import { FileTrieNode } from "../../util/fileTrie"
import { FullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { ContentDetails } from "../../plugins/emitters/contentIndex"

type MaybeHTMLElement = HTMLElement | undefined

interface ParsedOptions {
  folderClickBehavior: "collapse" | "link"
  folderDefaultState: "collapsed" | "open"
  useSavedState: boolean
  sortFn: (a: FileTrieNode, b: FileTrieNode) => number
  filterFn: (node: FileTrieNode) => boolean
  mapFn: (node: FileTrieNode) => void
  order: "sort" | "filter" | "map"[]
}

type FolderState = {
  path: string
  collapsed: boolean
}

function toggleExplorer(this: HTMLElement) {
  const nearestExplorer = this.closest(".explorer") as HTMLElement
  if (!nearestExplorer) return
  const explorerCollapsed = nearestExplorer.classList.toggle("collapsed")
  nearestExplorer.setAttribute(
    "aria-expanded",
    nearestExplorer.getAttribute("aria-expanded") === "true" ? "false" : "true",
  )

  if (!explorerCollapsed) {
    document.documentElement.classList.add("mobile-no-scroll")
  } else {
    document.documentElement.classList.remove("mobile-no-scroll")
  }
}

function makeToggleFolder(explorerState: Array<FolderState>, storageKey: string) {
  return function toggleFolder(evt: MouseEvent) {
    evt.stopPropagation()
    const target = evt.target as MaybeHTMLElement
    if (!target) return

    const isSvg = target.nodeName === "svg"
    const folderContainer = (
      isSvg ? target.parentElement : target.parentElement?.parentElement
    ) as MaybeHTMLElement
    if (!folderContainer) return
    const childFolderContainer = folderContainer.nextElementSibling as MaybeHTMLElement
    if (!childFolderContainer) return

    childFolderContainer.classList.toggle("open")
    const isCollapsed = !childFolderContainer.classList.contains("open")
    setFolderState(childFolderContainer, isCollapsed)

    const currentFolderState = explorerState.find(
      (item) => item.path === folderContainer.dataset.folderpath,
    )
    if (currentFolderState) {
      currentFolderState.collapsed = isCollapsed
    } else {
      explorerState.push({
        path: folderContainer.dataset.folderpath as FullSlug,
        collapsed: isCollapsed,
      })
    }

    localStorage.setItem(storageKey, JSON.stringify(explorerState))
  }
}

function createFileNode(currentSlug: FullSlug, node: FileTrieNode): HTMLLIElement {
  const template = document.getElementById("template-file") as HTMLTemplateElement
  const clone = template.content.cloneNode(true) as DocumentFragment
  const li = clone.querySelector("li") as HTMLLIElement
  const a = li.querySelector("a") as HTMLAnchorElement
  a.href = resolveRelative(currentSlug, node.slug)
  a.dataset.for = node.slug
  a.textContent = node.displayName

  if (currentSlug === node.slug) {
    a.classList.add("active")
  }

  return li
}

function createFolderNode(
  currentSlug: FullSlug,
  node: FileTrieNode,
  opts: ParsedOptions,
  explorerState: Array<FolderState>,
): HTMLLIElement {
  const template = document.getElementById("template-folder") as HTMLTemplateElement
  const clone = template.content.cloneNode(true) as DocumentFragment
  const li = clone.querySelector("li") as HTMLLIElement
  const folderContainer = li.querySelector(".folder-container") as HTMLElement
  const titleContainer = folderContainer.querySelector("div") as HTMLElement
  const folderOuter = li.querySelector(".folder-outer") as HTMLElement
  const ul = folderOuter.querySelector("ul") as HTMLUListElement

  const folderPath = node.slug
  folderContainer.dataset.folderpath = folderPath

  if (currentSlug === folderPath) {
    folderContainer.classList.add("active")
  }

  if (opts.folderClickBehavior === "link") {
    const button = titleContainer.querySelector(".folder-button") as HTMLElement
    const a = document.createElement("a")
    a.href = resolveRelative(currentSlug, folderPath)
    a.dataset.for = folderPath
    a.className = "folder-title"
    a.textContent = node.displayName
    button.replaceWith(a)
  } else {
    const span = titleContainer.querySelector(".folder-title") as HTMLElement
    span.textContent = node.displayName
  }

  const isCollapsed =
    explorerState.find((item) => item.path === folderPath)?.collapsed ??
    opts.folderDefaultState === "collapsed"

  const simpleFolderPath = simplifySlug(folderPath)
  const folderIsPrefixOfCurrentSlug =
    simpleFolderPath === currentSlug.slice(0, simpleFolderPath.length)

  if (!isCollapsed || folderIsPrefixOfCurrentSlug) {
    folderOuter.classList.add("open")
  }

  for (const child of node.children) {
    const childNode = child.isFolder
      ? createFolderNode(currentSlug, child, opts, explorerState)
      : createFileNode(currentSlug, child)
    ul.appendChild(childNode)
  }

  return li
}

async function setupExplorer(currentSlug: FullSlug) {
  const allExplorers = document.querySelectorAll("div.explorer") as NodeListOf<HTMLElement>

  // Collect every explorer's startPath up-front so each explorer can tell
  // whether the current page belongs to a *different* section.
  const allStartPaths = Array.from(allExplorers)
    .map((e) => e.dataset.startpath)
    .filter((p): p is string => !!p)

  for (const explorer of allExplorers) {
    const dataFns = JSON.parse(explorer.dataset.dataFns || "{}")
    const opts: ParsedOptions = {
      folderClickBehavior: (explorer.dataset.behavior || "collapse") as "collapse" | "link",
      folderDefaultState: (explorer.dataset.collapsed || "collapsed") as "collapsed" | "open",
      useSavedState: explorer.dataset.savestate === "true",
      order: dataFns.order || ["filter", "map", "sort"],
      sortFn: new Function("return " + (dataFns.sortFn || "undefined"))(),
      filterFn: new Function("return " + (dataFns.filterFn || "undefined"))(),
      mapFn: new Function("return " + (dataFns.mapFn || "undefined"))(),
    }

    // Use a per-explorer storage key so Skills and Tools don't clobber each other
    const startPath = explorer.dataset.startpath ?? ""
    const storageKey = startPath ? `fileTree-${startPath}` : "fileTree"
    const scrollKey = startPath ? `explorerScrollTop-${startPath}` : "explorerScrollTop"

    const storageTree = localStorage.getItem(storageKey)
    const serializedExplorerState = storageTree && opts.useSavedState ? JSON.parse(storageTree) : []
    const oldIndex = new Map<string, boolean>(
      serializedExplorerState.map((entry: FolderState) => [entry.path, entry.collapsed]),
    )

    const data = await fetchData
    const entries = [...Object.entries(data)] as [FullSlug, ContentDetails][]
    const trie = FileTrieNode.fromEntries(entries)

    for (const fn of opts.order) {
      switch (fn) {
        case "filter":
          if (opts.filterFn) trie.filter(opts.filterFn)
          break
        case "map":
          if (opts.mapFn) trie.map(opts.mapFn)
          break
        case "sort":
          if (opts.sortFn) trie.sort(opts.sortFn)
          break
      }
    }

    // Build per-explorer folder state from this trie only
    const folderPaths = trie.getFolderPaths()
    const explorerState: Array<FolderState> = folderPaths.map((path) => {
      const previousState = oldIndex.get(path)
      return {
        path,
        collapsed:
          previousState === undefined ? opts.folderDefaultState === "collapsed" : previousState,
      }
    })

    const explorerUl = explorer.querySelector(".explorer-ul")
    if (!explorerUl) continue

    // Render from subtree root when startPath is set
    const renderRoot = startPath ? (trie.findNode(startPath.split("/")) ?? trie) : trie

    const fragment = document.createDocumentFragment()
    for (const child of renderRoot.children) {
      const node = child.isFolder
        ? createFolderNode(currentSlug, child, opts, explorerState)
        : createFileNode(currentSlug, child)
      fragment.appendChild(node)
    }
    explorerUl.insertBefore(fragment, explorerUl.firstChild)

    // Auto-open/collapse this explorer based on what section the current page is in:
    //   - currentSlug is inside MY section → open
    //   - currentSlug is inside SOMEONE ELSE'S section → collapse
    //   - otherwise → leave SSR default
    if (startPath) {
      const desktopButton = explorer.querySelector(".desktop-explorer") as HTMLElement | null
      const inMySection = currentSlug.startsWith(startPath + "/") || currentSlug === startPath
      const inOtherSection = allStartPaths.some(
        (p) => p !== startPath && (currentSlug.startsWith(p + "/") || currentSlug === p),
      )

      if (inMySection) {
        explorer.classList.remove("collapsed")
        explorer.setAttribute("aria-expanded", "true")
        desktopButton?.setAttribute("aria-expanded", "true")
      } else if (inOtherSection) {
        explorer.classList.add("collapsed")
        explorer.setAttribute("aria-expanded", "false")
        desktopButton?.setAttribute("aria-expanded", "false")
      }
    }

    const scrollTop = sessionStorage.getItem(scrollKey)
    if (scrollTop) {
      explorerUl.scrollTop = parseInt(scrollTop)
    } else {
      const activeElement = explorerUl.querySelector(".active")
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth" })
      }
    }

    // Wire expand/collapse buttons for this explorer
    const explorerButtons = explorer.getElementsByClassName(
      "explorer-toggle",
    ) as HTMLCollectionOf<HTMLElement>
    for (const button of explorerButtons) {
      button.addEventListener("click", toggleExplorer)
      window.addCleanup(() => button.removeEventListener("click", toggleExplorer))
    }

    // Create a toggleFolder closure bound to this explorer's state
    const toggleFolder = makeToggleFolder(explorerState, storageKey)

    if (opts.folderClickBehavior === "collapse") {
      const folderButtons = explorer.getElementsByClassName(
        "folder-button",
      ) as HTMLCollectionOf<HTMLElement>
      for (const button of folderButtons) {
        button.addEventListener("click", toggleFolder)
        window.addCleanup(() => button.removeEventListener("click", toggleFolder))
      }
    }

    const folderIcons = explorer.getElementsByClassName(
      "folder-icon",
    ) as HTMLCollectionOf<HTMLElement>
    for (const icon of folderIcons) {
      icon.addEventListener("click", toggleFolder)
      window.addCleanup(() => icon.removeEventListener("click", toggleFolder))
    }
  }
}

document.addEventListener("prenav", async () => {
  // Save scroll position for each explorer separately
  const allExplorers = document.querySelectorAll("div.explorer") as NodeListOf<HTMLElement>
  for (const explorer of allExplorers) {
    const explorerUl = explorer.querySelector(".explorer-ul")
    if (!explorerUl) continue
    const startPath = explorer.dataset.startpath ?? ""
    const scrollKey = startPath ? `explorerScrollTop-${startPath}` : "explorerScrollTop"
    sessionStorage.setItem(scrollKey, explorerUl.scrollTop.toString())
  }
})

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  await setupExplorer(currentSlug)

  for (const explorer of document.getElementsByClassName("explorer")) {
    const mobileExplorer = explorer.querySelector(".mobile-explorer")
    if (!mobileExplorer) return

    if (mobileExplorer.checkVisibility()) {
      explorer.classList.add("collapsed")
      explorer.setAttribute("aria-expanded", "false")
      document.documentElement.classList.remove("mobile-no-scroll")
    }

    mobileExplorer.classList.remove("hide-until-loaded")
  }
})

window.addEventListener("resize", function () {
  const explorer = document.querySelector(".explorer")
  if (explorer && !explorer.classList.contains("collapsed")) {
    document.documentElement.classList.add("mobile-no-scroll")
    return
  }
})

function setFolderState(folderElement: HTMLElement, collapsed: boolean) {
  return collapsed ? folderElement.classList.remove("open") : folderElement.classList.add("open")
}
