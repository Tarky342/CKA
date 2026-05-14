import * as fs from "fs/promises"
import * as path from "path"
import { generate } from "./ollama.js"
import { buildSummaryPrompt, buildReportTemplate } from "./prompt.js"
import { getDiff } from "./git/getDiff.js"

export interface ReportOptions {
  projectDir?: string
  outputDir?: string
}

function getProjectName(): string {
  const cwd = process.cwd()
  const parts = cwd.split(path.sep)
  return parts[parts.length - 1] || "project"
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

export async function generateDiffReport(options: ReportOptions = {}): Promise<string> {
  const projectDir = options.projectDir
  const projectName = projectDir ? path.basename(path.resolve(projectDir)) : getProjectName()
  const outputDir = options.outputDir || "output"

  const diff = getDiff(projectDir)
  if (!diff.trim()) {
    console.log("No uncommitted changes found.")
    return ""
  }

  console.log("Generating report from diff...")
  const prompt = buildSummaryPrompt(diff)
  const diffSummary = await generate(prompt)

  const now = new Date()
  const timestamp = now.toISOString()
  const timeLabel = formatTimestamp(now)

  const report = buildReportTemplate(projectName, timestamp, diffSummary)

  await fs.mkdir(outputDir, { recursive: true })

  const fileName = `${projectName}_${timeLabel}.md`
  const filePath = path.join(outputDir, fileName)

  await fs.writeFile(filePath, report, "utf-8")

  console.log(`Report saved: ${filePath}`)

  return filePath
}

export {}
