import * as fs from "fs/promises"
import * as path from "path"

import { analyzeStep0_AST } from "./analyzeAST.js"

export interface AnalysisCache {
  projectName: string
  timestamp: string
  stats: {
    byExt: Record<string, { count: number; lines: number }>
    totalFiles: number
    totalLines: number
    topFiles: { file: string; bytes: number }[]
  }
  todos: { file: string; line: number; text: string }[]
  metadata: {
    package?: any
    gitInfo?: any
    projectDetection?: ProjectDetection
    dependencyCategories?: DependencyCategory[]
    directoryStructure?: DirectoryStructureSummary
  }
}

interface FileInventoryRecord {
  path: string
  ext: string
  size: number
  lines: number
  modifiedTime: string
  encoding: string
}

interface ProjectDetection {
  projectTypes: string[]
  signals: string[]
  strategy: string[]
}

interface DependencyCategory {
  category: string
  package: string
  version: string
  source: string
}

interface DirectoryStructureSummary {
  topLevelFolders: { name: string; fileCount: number; totalLines: number }[]
  importantFolders: { name: string; present: boolean; fileCount: number }[]
  signals: string[]
}

interface ResearchItem {
  title: string
  reason: string
  sourceFiles: string[]
  focus: string
}

interface ResearchFinding {
  title: string
  sourceFiles: string[]
  evidence: string[]
  summary: string
}

const BINARY_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".7z",
  ".rar",
  ".mp4",
  ".mp3",
  ".wav",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
])

const IMPORTANT_FOLDERS = ["app", "components", "hooks", "lib", "services", "store", "api", "pages", "src", "public", "features", "packages"]

const CATEGORY_RULES: Array<{ category: string; test: (name: string) => boolean }> = [
  { category: "framework", test: name => /^(next|react|react-dom|react-native|expo|vite|vue|nuxt|svelte|angular|electron)$/.test(name) },
  { category: "animation", test: name => /(gsap|framer-motion|motion|lenis|animejs|lottie)/.test(name) },
  { category: "state management", test: name => /(zustand|redux|@reduxjs\/toolkit|jotai|recoil|mobx|valtio|nanostores)/.test(name) },
  { category: "database", test: name => /(prisma|mongoose|drizzle|typeorm|sequelize|pg|mysql2|mongodb|firebase|supabase|better-sqlite3|sqlite3)/.test(name) },
  { category: "auth", test: name => /(next-auth|auth0|clerk|passport|msal|@azure\/msal|firebase-admin|@clerk)/.test(name) },
  { category: "testing", test: name => /(jest|vitest|mocha|chai|playwright|cypress|testing-library|@playwright\/test|ava)/.test(name) },
  { category: "CMS", test: name => /(sanity|contentful|strapi|payload|prismic|storyblok)/.test(name) },
]

function formatTimestamp(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

async function walk(dir: string, ignore: Set<string>): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (ignore.has(entry.name)) continue
    if (entry.isDirectory()) {
      files = files.concat(await walk(full, ignore))
    } else {
      files.push(full)
    }
  }
  return files
}

async function getCacheDir(outputDir: string): Promise<string> {
  const cacheDir = path.join(outputDir, ".analysis_cache")
  await fs.mkdir(cacheDir, { recursive: true })
  return cacheDir
}

function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase())
}

function normalizePathForMatch(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase()
}

function isTextLikeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return !isBinaryExtension(ext)
}

async function buildFileInventory(cwd: string, relativeFiles: string[]): Promise<{ files: FileInventoryRecord[]; byExt: Record<string, { count: number; lines: number }> }> {
  const files: FileInventoryRecord[] = []
  const byExt: Record<string, { count: number; lines: number }> = {}

  for (const rel of relativeFiles) {
    const abs = path.join(cwd, rel)
    try {
      const stat = await fs.stat(abs)
      const ext = path.extname(rel) || "<no_ext>"
      const encoding = isBinaryExtension(ext) ? "binary" : "utf-8"

      if (!byExt[ext]) byExt[ext] = { count: 0, lines: 0 }
      byExt[ext].count += 1

      let lines = 0
      if (stat.isFile() && stat.size > 0 && encoding === "utf-8") {
        try {
          const content = await fs.readFile(abs, "utf-8")
          lines = content.split(/\r?\n/).length
          byExt[ext].lines += lines
        } catch (e) {
          lines = 0
        }
      }

      files.push({
        path: rel,
        ext,
        size: stat.size,
        lines,
        modifiedTime: stat.mtime.toISOString(),
        encoding,
      })
    } catch (e) {
      // ignore
    }
  }

  return { files, byExt }
}

function buildProjectDetection(cwd: string, relativeFiles: string[], pkg: any): ProjectDetection {
  const signals: string[] = []
  const strategy: string[] = []
  const projectTypes: string[] = []
  const fileSet = new Set(relativeFiles.map(file => file.replace(/\\/g, "/").toLowerCase()))
  const hasNextDep = Boolean(pkg?.dependencies?.next || pkg?.devDependencies?.next)
  const hasReactNativeDep = Boolean(pkg?.dependencies?.["react-native"] || pkg?.devDependencies?.["react-native"] || pkg?.dependencies?.expo)
  const hasElectronDep = Boolean(pkg?.dependencies?.electron || pkg?.devDependencies?.electron)
  const hasWorkspace = Boolean(pkg?.workspaces) || fileSet.has("pnpm-workspace.yaml")

  if (fileSet.has("next.config.js") || fileSet.has("next.config.mjs") || fileSet.has("next.config.ts") || hasNextDep) {
    projectTypes.push("Next.js")
    signals.push("next.config.* または next dependency を検出")
    strategy.push("App Router解析ON")
    strategy.push("SSR解析ON")
    strategy.push("metadata解析ON")
  }

  if (fileSet.has("vite.config.ts") || fileSet.has("vite.config.js") || fileSet.has("vite.config.mts") || fileSet.has("vite.config.mjs")) {
    projectTypes.push("Vite")
    signals.push("vite.config.* を検出")
    strategy.push("Vite前提のクライアント構成として解析")
  }

  if (fileSet.has("app.json") && hasReactNativeDep) {
    projectTypes.push("React Native")
    signals.push("app.json と react-native/expo dependency を検出")
    strategy.push("モバイル画面構成を優先して解析")
  }

  if (hasElectronDep || fileSet.has("electron/main.js") || fileSet.has("electron/main.ts")) {
    projectTypes.push("Electron")
    signals.push("electron dependency または electron/main.* を検出")
    strategy.push("main/preload/renderer 分離を確認")
  }

  if (hasWorkspace) {
    projectTypes.push("Monorepo")
    signals.push("workspaces または pnpm-workspace.yaml を検出")
    strategy.push("packages/ 配下の依存分離を優先")
  }

  if (projectTypes.length === 0) {
    projectTypes.push("Generic")
    strategy.push("汎用静的解析として扱う")
  }

  if (fileSet.has("app/")) {
    signals.push("app/ フォルダを検出")
  }
  if (fileSet.has("pages/")) {
    signals.push("pages/ フォルダを検出")
  }

  return { projectTypes, signals, strategy }
}

function buildDependencyCategories(pkg: any): DependencyCategory[] {
  const categories: DependencyCategory[] = []
  const sections: Array<[string, Record<string, string> | undefined]> = [
    ["dependencies", pkg?.dependencies],
    ["devDependencies", pkg?.devDependencies],
    ["peerDependencies", pkg?.peerDependencies],
  ]

  for (const [source, deps] of sections) {
    if (!deps) continue
    for (const [pkgName, version] of Object.entries(deps)) {
      const normalized = pkgName.toLowerCase()
      for (const rule of CATEGORY_RULES) {
        if (rule.test(normalized)) {
          categories.push({
            category: rule.category,
            package: pkgName,
            version: String(version),
            source,
          })
          break
        }
      }
    }
  }

  categories.sort((a, b) => a.category.localeCompare(b.category) || a.package.localeCompare(b.package))
  return categories
}

function buildDirectoryStructure(relativeFiles: string[]): DirectoryStructureSummary {
  const folderStats = new Map<string, { fileCount: number; totalLines: number }>()

  for (const rel of relativeFiles) {
    const normalized = rel.replace(/\\/g, "/")
    const segments = normalized.split("/")
    const topLevel = segments[0] || "<root>"
    const current = folderStats.get(topLevel) || { fileCount: 0, totalLines: 0 }
    current.fileCount += 1
    folderStats.set(topLevel, current)
  }

  const topLevelFolders = Array.from(folderStats.entries())
    .map(([name, value]) => ({ name, fileCount: value.fileCount, totalLines: value.totalLines }))
    .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name))

  const importantFolders = IMPORTANT_FOLDERS.map(name => ({
    name,
    present: relativeFiles.some(file => file.replace(/\\/g, "/").startsWith(`${name}/`) || file.replace(/\\/g, "/") === name),
    fileCount: relativeFiles.filter(file => file.replace(/\\/g, "/").startsWith(`${name}/`)).length,
  }))

  const signals: string[] = []
  if (importantFolders.find(folder => folder.name === "hooks")?.present) {
    signals.push("hooks/ exists → custom hook architecture")
  }
  if (importantFolders.find(folder => folder.name === "services")?.present) {
    signals.push("services/ exists → service layer separation")
  }
  if (importantFolders.find(folder => folder.name === "api")?.present) {
    signals.push("api/ exists → API layer separation")
  }
  if (importantFolders.find(folder => folder.name === "app")?.present) {
    signals.push("app/ exists → App Router architecture")
  }
  if (importantFolders.find(folder => folder.name === "pages")?.present) {
    signals.push("pages/ exists → Pages Router architecture")
  }

  return { topLevelFolders, importantFolders, signals }
}

function buildResearchPlan(
  relativeFiles: string[],
  scanData: any,
  metadata: any,
  astData: any
): ResearchItem[] {
  const normalizedFiles = relativeFiles.map(normalizePathForMatch)
  const fileSet = new Set(normalizedFiles)
  const plan: ResearchItem[] = []

  const sourceCandidates = (patterns: string[]) =>
    relativeFiles.filter(file => patterns.some(pattern => normalizePathForMatch(file).includes(pattern)))

  const hasNextConfig = fileSet.has("next.config.js") || fileSet.has("next.config.mjs") || fileSet.has("next.config.ts")
  const hasAppRouter = normalizedFiles.some(file => file.startsWith("app/"))
  const hasPagesRouter = normalizedFiles.some(file => file.startsWith("pages/"))
  const hasSanity = normalizedFiles.some(file => file.includes("sanity")) || Boolean(metadata?.package?.dependencies?.sanity || metadata?.package?.devDependencies?.sanity)
  const has3D = Boolean(
    metadata?.package?.dependencies?.three ||
    metadata?.package?.dependencies?.["@react-three/fiber"] ||
    metadata?.package?.dependencies?.["@react-three/drei"]
  )
  const hasAnimation = Boolean(metadata?.package?.dependencies?.gsap || metadata?.package?.dependencies?.motion || metadata?.package?.dependencies?.lenis)
  const hasImageHeavyAssets = Array.isArray(scanData?.files) && scanData.files.some((file: any) => [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(String(file.ext).toLowerCase()) && file.size >= 50000)
  const hasClientComponents = Array.isArray(astData?.files) && astData.files.some((file: any) => Array.isArray(file?.imports) && file.imports.length > 0)

  if (hasNextConfig || hasAppRouter || hasPagesRouter) {
    plan.push({
      title: "Next.js 実装の詳細調査",
      reason: "プロジェクト種別の一次推論で Next.js 系の可能性があるため、ルーティングと SSR/metadata を追加確認する",
      sourceFiles: [
        ...sourceCandidates(["next.config."]),
        ...sourceCandidates(["app/"]).slice(0, 10),
        ...sourceCandidates(["pages/"]).slice(0, 10),
      ],
      focus: "app router / pages router / metadata / server rendering",
    })
  }

  if (hasSanity) {
    plan.push({
      title: "Sanity 連携の責務分離調査",
      reason: "CMS 依存があるため、UI とデータ取得の分離を確認する",
      sourceFiles: sourceCandidates(["sanity", "lib", "api", "services"]).slice(0, 12),
      focus: "CMS schema / query / client-server separation",
    })
  }

  if (has3D) {
    plan.push({
      title: "3D コンポーネント調査",
      reason: "three.js 系の依存があるため、描画責務と bundle heavy 領域を確認する",
      sourceFiles: sourceCandidates(["three", "fiber", "drei", "components", "app"]).slice(0, 15),
      focus: "3D scene / canvas / render cost",
    })
  }

  if (hasAnimation) {
    plan.push({
      title: "アニメーション重複調査",
      reason: "GSAP / motion / lenis の併用があると責務競合しやすいため、使用場所を確認する",
      sourceFiles: sourceCandidates(["gsap", "motion", "lenis", "components", "app"]).slice(0, 15),
      focus: "animation overlap / client component pressure",
    })
  }

  if (hasImageHeavyAssets) {
    plan.push({
      title: "画像・アセット最適化調査",
      reason: "重い画像が存在するため、next/image 化や WebP 置換の余地を確認する",
      sourceFiles: sourceCandidates(["public/", "components/", "app/"]).slice(0, 20),
      focus: "asset grouping / next.image usage / compression candidates",
    })
  }

  if (hasClientComponents) {
    plan.push({
      title: "クライアントコンポーネント依存調査",
      reason: "import 数のあるコンポーネント群が見えるため、use client の偏りを確認する",
      sourceFiles: sourceCandidates(["app/", "components/"]).slice(0, 20),
      focus: "use client / metadata / page-layout-component graph",
    })
  }

  if (Array.isArray(scanData?.files) && scanData.files.length > 0) {
    const largeSourceFiles = scanData.files
      .filter((file: any) => typeof file.path === "string" && isTextLikeFile(file.path) && file.size > 2000)
      .sort((a: any, b: any) => b.size - a.size)
      .slice(0, 5)
      .map((file: any) => file.path)

    if (largeSourceFiles.length > 0) {
      plan.push({
        title: "巨大ソースファイル再調査",
        reason: "テキストベースの大容量ファイルは実装責務の集中が起きやすいため、局所的に再読する",
        sourceFiles: largeSourceFiles,
        focus: "God component / large module / refactor candidate",
      })
    }
  }

  if (plan.length === 0) {
    plan.push({
      title: "汎用追加調査",
      reason: "一次推論では明確な特徴が弱いため、主要ソースを広く追加確認する",
      sourceFiles: relativeFiles.filter(isTextLikeFile).slice(0, 12),
      focus: "general code structure",
    })
  }

  return plan
}

async function inspectSourceFiles(cwd: string, sourceFiles: string[], focus: string): Promise<ResearchFinding> {
  const evidence: string[] = []
  const seenFiles = new Set<string>()

  for (const rel of sourceFiles) {
    if (seenFiles.has(rel)) continue
    seenFiles.add(rel)

    const abs = path.join(cwd, rel)
    try {
      const stat = await fs.stat(abs)
      if (!stat.isFile() || !isTextLikeFile(rel)) continue

      const content = await fs.readFile(abs, "utf-8")
      const lines = content.split(/\r?\n/)
      const lower = content.toLowerCase()
      const clientCount = lines.filter(line => line.includes("use client")).length
      const metadataCount = lines.filter(line => /metadata|generateMetadata/.test(line)).length
      const nextImageCount = lines.filter(line => /next\/image|<Image\b/.test(line)).length
      const animationHits = lines.filter(line => /(gsap|motion|lenis|anime|framer-motion)/i.test(line)).length
      const threeHits = lines.filter(line => /(three|@react-three|canvas|orbitcontrols|mesh)/i.test(line)).length
      const sanityHits = lines.filter(line => /(sanity|groq|createClient|defineType|defineQuery)/i.test(line)).length

      if (clientCount > 0) evidence.push(`${rel}: use client = ${clientCount}`)
      if (metadataCount > 0) evidence.push(`${rel}: metadata/generateMetadata = ${metadataCount}`)
      if (nextImageCount > 0) evidence.push(`${rel}: next/image usage = ${nextImageCount}`)
      if (animationHits > 0) evidence.push(`${rel}: animation keyword hits = ${animationHits}`)
      if (threeHits > 0) evidence.push(`${rel}: 3D keyword hits = ${threeHits}`)
      if (sanityHits > 0) evidence.push(`${rel}: sanity keyword hits = ${sanityHits}`)

      const snippet = lines.slice(0, 20).join(" ").replace(/\s+/g, " ").slice(0, 220)
      if (snippet) {
        evidence.push(`${rel}: snippet -> ${snippet}`)
      }

      if (lower.includes("use client") && lower.includes("metadata")) {
        evidence.push(`${rel}: client component と metadata が同居している可能性`)
      }
    } catch (e) {
      evidence.push(`${rel}: 読み込み失敗`)
    }
  }

  const summary = evidence.length > 0
    ? `focus: ${focus} に対して ${evidence.length} 件の証拠を取得`
    : `focus: ${focus} に対する明確な証拠は少ない`

  return {
    title: focus,
    sourceFiles: Array.from(seenFiles),
    evidence: evidence.slice(0, 40),
    summary,
  }
}

function renderResearchPlan(plan: ResearchItem[]): string {
  let md = ``
  for (const item of plan) {
    md += `### ${item.title}\n\n`
    md += `- ねらい: ${item.reason}\n`
    md += `- 注目点: ${item.focus}\n`
    md += `- 該当元:\n`
    if (item.sourceFiles.length === 0) {
      md += `  - （該当候補なし）\n`
    } else {
      for (const file of item.sourceFiles.slice(0, 10)) {
        md += `  - ${file}\n`
      }
    }
    md += `\n`
  }
  return md
}

function renderResearchFindings(findings: ResearchFinding[]): string {
  let md = ``
  for (const item of findings) {
    md += `### ${item.title}\n\n`
    md += `- 要約: ${item.summary}\n`
    if (item.sourceFiles.length > 0) {
      md += `- 対象ファイル:\n`
      for (const file of item.sourceFiles.slice(0, 10)) {
        md += `  - ${file}\n`
      }
    }
    if (item.evidence.length > 0) {
      md += `- 証拠:\n`
      for (const line of item.evidence.slice(0, 12)) {
        md += `  - ${line}\n`
      }
    }
    md += `\n`
  }
  return md
}

function readJsonFile(filePath: string): Promise<any | null> {
  return fs.readFile(filePath, "utf-8")
    .then(text => JSON.parse(text))
    .catch(() => null)
}

function readAstSummary(astData: any): string[] {
  if (!astData?.summary) return []
  return [
    `関数: ${astData.summary.totalFunctions || 0}個`,
    `クラス: ${astData.summary.totalClasses || 0}個`,
    `インポート: ${astData.summary.totalImports || 0}個`,
    `エクスポート: ${astData.summary.totalExports || 0}個`,
    `TS: ${astData.summary.languages?.typescript || 0}, JS: ${astData.summary.languages?.javascript || 0}`,
  ]
}

export async function analyzeStep1_Scan(
  outputDir: string = "output",
  projectName?: string
): Promise<string> {
  const cwd = process.cwd()
  const projName = projectName || path.basename(cwd)
  const cacheDir = await getCacheDir(outputDir)
  const cacheFile = path.join(cacheDir, `${projName}_scan.json`)

  console.log(`[Step 1] ファイルスキャン中...`)

  const ignore = new Set(["node_modules", "dist", ".git", ".analysis_cache"])
  const allFiles = await walk(cwd, ignore)
  const relativeFiles = allFiles
    .filter(file => file.startsWith(cwd))
    .map(file => path.relative(cwd, file))

  const inventory = await buildFileInventory(cwd, relativeFiles)
  const sizes = inventory.files.map(file => ({ file: file.path, bytes: file.size }))
  sizes.sort((a, b) => b.bytes - a.bytes)

  const scanData = {
    files: inventory.files,
    byExt: inventory.byExt,
    totalFiles: inventory.files.length,
    totalLines: inventory.files.reduce((sum, file) => sum + file.lines, 0),
    topFiles: sizes.slice(0, 10),
  }

  await fs.writeFile(cacheFile, JSON.stringify(scanData, null, 2), "utf-8")
  console.log(`✅ スキャン結果をキャッシュ: ${cacheFile}`)

  return cacheFile
}

export async function analyzeStep2_ExtractTodos(
  outputDir: string = "output",
  projectName?: string
): Promise<string> {
  const cwd = process.cwd()
  const projName = projectName || path.basename(cwd)
  const cacheDir = await getCacheDir(outputDir)
  const todoFile = path.join(cacheDir, `${projName}_todos.json`)

  console.log(`[Step 2] TODO/FIXME を抽出中...`)

  const ignore = new Set(["node_modules", "dist", ".git", ".analysis_cache"])
  const allFiles = await walk(cwd, ignore)
  const relativeFiles = allFiles
    .filter(file => file.startsWith(cwd))
    .map(file => path.relative(cwd, file))

  const todos: { file: string; line: number; text: string }[] = []

  for (const rel of relativeFiles) {
    const abs = path.join(cwd, rel)
    try {
      const stat = await fs.stat(abs)
      if (stat.size > 0 && stat.isFile() && !isBinaryExtension(path.extname(rel) || "")) {
        const content = await fs.readFile(abs, "utf-8")
        const lines = content.split(/\r?\n/)
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]
          if (/TODO|FIXME|BUG/.test(l)) {
            todos.push({ file: rel, line: i + 1, text: l.trim() })
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  await fs.writeFile(todoFile, JSON.stringify(todos.slice(0, 100), null, 2), "utf-8")
  console.log(`✅ TODO抽出結果をキャッシュ: ${todoFile} (${todos.length}件)`)

  return todoFile
}

export async function analyzeStep3_ExtractMetadata(
  outputDir: string = "output",
  projectName?: string
): Promise<string> {
  const cwd = process.cwd()
  const projName = projectName || path.basename(cwd)
  const cacheDir = await getCacheDir(outputDir)
  const metaFile = path.join(cacheDir, `${projName}_metadata.json`)

  console.log(`[Step 3] メタデータ抽出中...`)

  const metadata: any = {}
  const ignore = new Set(["node_modules", "dist", ".git", ".analysis_cache"])
  const allFiles = await walk(cwd, ignore)
  const relativeFiles = allFiles
    .filter(file => file.startsWith(cwd))
    .map(file => path.relative(cwd, file))

  try {
    const pkgText = await fs.readFile(path.join(cwd, "package.json"), "utf-8")
    metadata.package = JSON.parse(pkgText)
  } catch (e) {
    // ignore
  }

  try {
    const gitHead = await fs.readFile(path.join(cwd, ".git", "HEAD"), "utf-8")
    metadata.gitBranch = gitHead.trim()
  } catch (e) {
    // ignore
  }

  metadata.projectDetection = buildProjectDetection(cwd, relativeFiles, metadata.package)
  metadata.dependencyCategories = buildDependencyCategories(metadata.package)
  metadata.directoryStructure = buildDirectoryStructure(relativeFiles)

  await fs.writeFile(metaFile, JSON.stringify(metadata, null, 2), "utf-8")
  console.log(`✅ メタデータをキャッシュ: ${metaFile}`)

  return metaFile
}

export async function analyzeStep4_GenerateReport(
  outputDir: string = "output",
  projectName?: string
): Promise<string> {
  const cwd = process.cwd()
  const projName = projectName || path.basename(cwd)
  const cacheDir = await getCacheDir(outputDir)

  console.log(`[Step 4] 最終レポート生成中...`)

  const scanFile = path.join(cacheDir, `${projName}_scan.json`)
  const todoFile = path.join(cacheDir, `${projName}_todos.json`)
  const metaFile = path.join(cacheDir, `${projName}_metadata.json`)
  const astFile = path.join(cacheDir, `${projName}_ast.json`)

  const scanData = (await readJsonFile(scanFile)) || {}
  const todos = (await readJsonFile(todoFile)) || []
  const metadata = (await readJsonFile(metaFile)) || {}
  const astData = (await readJsonFile(astFile)) || {}
  const relativeFiles = Array.isArray(scanData.files)
    ? scanData.files.map((file: any) => String(file.path || "")).filter(Boolean)
    : []

  const now = new Date()
  const timestamp = now.toISOString()

  let md = `# ${projName} - プロジェクト解析レポート\n\n`
  md += `**生成日時**: ${timestamp}\n\n---\n\n`

  md += `## Phase 1 - ファイル収集\n\n`
  md += `- ファイル数: ${scanData.totalFiles || 0}\n`
  md += `- 総行数（推定）: ${scanData.totalLines || 0}\n`
  md += `- ファイルインベントリ: ${Array.isArray(scanData.files) ? scanData.files.length : 0}件\n\n`

  if (Array.isArray(scanData.files) && scanData.files.length > 0) {
    md += `### サンプルインベントリ\n\n`
    md += `| path | ext | size | lines | modified | encoding |\n`
    md += `| --- | --- | ---: | ---: | --- | --- |\n`
    for (const file of scanData.files.slice(0, 8)) {
      md += `| ${file.path} | ${file.ext} | ${file.size} | ${file.lines} | ${file.modifiedTime} | ${file.encoding} |\n`
    }
    md += `\n`
  }

  md += `## Phase 2 - プロジェクト種別推定\n\n`
  const projectDetection = metadata.projectDetection || { projectTypes: ["Generic"], signals: [], strategy: [] }
  md += `- 判定: ${projectDetection.projectTypes.join(", ")}\n`
  if (projectDetection.signals?.length > 0) {
    md += `- シグナル:\n`
    for (const signal of projectDetection.signals) {
      md += `  - ${signal}\n`
    }
  }
  if (projectDetection.strategy?.length > 0) {
    md += `- 戦略:\n`
    for (const item of projectDetection.strategy) {
      md += `  - ${item}\n`
    }
  }

  md += `\n## Phase 3 - 依存関係カテゴリ解析\n\n`
  const dependencyCategories: DependencyCategory[] = metadata.dependencyCategories || []
  if (dependencyCategories.length === 0) {
    md += `（カテゴリ化できる依存関係なし）\n`
  } else {
    for (const item of dependencyCategories) {
      md += `- ${item.category}: ${item.package} (${item.version}) [${item.source}]\n`
    }
  }

  md += `\n## Phase 4 - ディレクトリ構造解析\n\n`
  const directoryStructure: DirectoryStructureSummary = metadata.directoryStructure || { topLevelFolders: [], importantFolders: [], signals: [] }
  if (directoryStructure.topLevelFolders.length === 0) {
    md += `（ディレクトリ情報なし）\n`
  } else {
    md += `### トップレベルフォルダ\n\n`
    for (const folder of directoryStructure.topLevelFolders.slice(0, 12)) {
      md += `- ${folder.name}: ${folder.fileCount} files\n`
    }
  }
  if (directoryStructure.importantFolders.length > 0) {
    md += `\n### 重要フォルダ判定\n\n`
    for (const folder of directoryStructure.importantFolders) {
      const status = folder.present ? "present" : "absent"
      md += `- ${folder.name}: ${status} (${folder.fileCount} files)\n`
    }
  }
  if (directoryStructure.signals.length > 0) {
    md += `\n### 構造シグナル\n\n`
    for (const signal of directoryStructure.signals) {
      md += `- ${signal}\n`
    }
  }

  md += `\n## Phase 5 - AST解析\n\n`
  const astSummary = readAstSummary(astData)
  if (astSummary.length === 0) {
    md += `（ASTキャッシュなし）\n`
  } else {
    for (const line of astSummary) {
      md += `- ${line}\n`
    }
  }

  md += `\n## Phase 6 - 一次推論まとめ\n\n`
  md += `- プロジェクト種別: ${(projectDetection.projectTypes || ["Generic"]).join(", ")}\n`
  md += `- 依存関係カテゴリ数: ${dependencyCategories.length}\n`
  md += `- 重要フォルダ検出数: ${directoryStructure.importantFolders.filter(folder => folder.present).length}\n`
  md += `- AST 対象数: ${astSummary.length > 0 ? astSummary.length : 0}\n`

  const researchPlan = buildResearchPlan(relativeFiles, scanData, metadata, astData)
  md += `\n## Phase 7 - 追加調査項目と該当元\n\n`
  md += renderResearchPlan(researchPlan)

  const researchFindings: ResearchFinding[] = []
  for (const item of researchPlan) {
    researchFindings.push(await inspectSourceFiles(cwd, item.sourceFiles, item.focus))
  }

  md += `\n## Phase 8 - 追加調査結果\n\n`
  md += renderResearchFindings(researchFindings)

  md += `\n## Phase 9 - 統合評価\n\n`
  if (researchFindings.length > 0) {
    const positiveSignals = researchFindings.flatMap(item => item.evidence).filter(Boolean).length
    md += `- 一次推論で抽出した構造情報に対し、追加調査で ${positiveSignals} 件の証拠を回収した\n`
    md += `- 解析は静的事実 → 追加ソース調査 → 統合評価 の順で進めた\n`
    md += `- 次に実装すべきなのは、調査結果を受けた LLM 推論層とスコアリング層の切り出しである\n`
  } else {
    md += `- 追加調査候補が少ないため、一次推論の拡張が必要\n`
  }

  md += `\n## TODO / FIXME 抽出\n\n`
  if (todos.length === 0) {
    md += `（TODOなし）\n`
  } else {
    for (const t of todos) {
      md += `- ${t.file}#L${t.line}: ${t.text}\n`
    }
  }

  if (metadata.package) {
    md += `\n## package.json 情報\n\n`
    md += `- name: ${metadata.package.name || "-"}\n`
    md += `- version: ${metadata.package.version || "-"}\n`
    if (metadata.package.dependencies) {
      md += `- dependencies:\n`
      for (const k of Object.keys(metadata.package.dependencies)) {
        md += `  - ${k}: ${metadata.package.dependencies[k]}\n`
      }
    }
  }

  md += `\n---\n\nGenerated by analyzeProject.ts (multi-step pipeline)\n`

  await fs.mkdir(outputDir, { recursive: true })
  const fileName = `${projName}_analysis_${formatTimestamp(now)}.md`
  const reportPath = path.join(outputDir, fileName)
  await fs.writeFile(reportPath, md, "utf-8")

  console.log(`✅ レポート生成完了: ${reportPath}`)

  return reportPath
}

export async function analyzeProjectFull(
  outputDir: string = "output",
  projectName?: string
): Promise<string> {
  console.log(`\n🔍 [マルチステップ解析開始]\n`)
  await analyzeStep0_AST(projectName || "project", outputDir)
  await analyzeStep1_Scan(outputDir, projectName)
  await analyzeStep2_ExtractTodos(outputDir, projectName)
  await analyzeStep3_ExtractMetadata(outputDir, projectName)
  const reportPath = await analyzeStep4_GenerateReport(outputDir, projectName)
  console.log(`\n✅ [マルチステップ解析完了]\n`)
  return reportPath
}

export {}
