// Tool name → riskLevel ("low" | "medium" | "high" | "critical"), populated
// once at the start of each build by `build.ts` as it scans the .ts source
// files in `github-source/`. Both the SkillMeta component and the ToolLinks
// transformer read from this map so every tool badge — in the metadata box
// and in body backticks — can be painted with the correct risk palette.
export const toolRisks = new Map<string, string>()

export function riskClass(risk: string | undefined): string | undefined {
  switch (risk) {
    case "low":
      return "skill-tool-low"
    case "medium":
      return "skill-tool-medium"
    case "high":
    case "critical":
      return "skill-tool-high"
    default:
      return undefined
  }
}
