document.addEventListener("nav", () => {
  const skillMeta = document.querySelector<HTMLElement>(".skill-meta")
  if (!skillMeta) return

  const toolsData = skillMeta.dataset.tools
  if (!toolsData) return

  const tools = new Set<string>(JSON.parse(toolsData))
  if (!tools.size) return

  const article = document.querySelector("article")
  if (!article) return

  // Style inline <code> elements matching a tool name
  // Skip <code> inside <pre> (those are fenced code blocks, not inline refs)
  article.querySelectorAll<HTMLElement>("code").forEach((el) => {
    if (el.closest("pre")) return
    if (el.closest(".skill-meta")) return
    if (tools.has(el.textContent?.trim() ?? "")) {
      el.classList.add("skill-tool")
    }
  })

  // Also handle plain-text tool mentions (walk text nodes)
  const sorted = [...tools].sort((a, b) => b.length - a.length)
  const escaped = sorted.map((t) => t.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"))
  const pattern = new RegExp(escaped.join("|"), "g")

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentNode
      while (p && p !== article) {
        const el = p as Element
        if (el.tagName === "CODE" || el.tagName === "PRE" || el.classList?.contains("skill-meta")) {
          return NodeFilter.FILTER_REJECT
        }
        p = p.parentNode
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n as Text)

  for (const textNode of nodes) {
    const text = textNode.textContent ?? ""
    pattern.lastIndex = 0
    if (!pattern.test(text)) continue
    pattern.lastIndex = 0

    const frag = document.createDocumentFragment()
    let last = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)))
      }
      const badge = document.createElement("code")
      badge.className = "skill-tool"
      badge.textContent = match[0]
      frag.appendChild(badge)
      last = match.index + match[0].length
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)))
    }
    textNode.parentNode?.replaceChild(frag, textNode)
  }
})
