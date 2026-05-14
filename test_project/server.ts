import http from "http"
import fs from "fs"
import path from "path"
import { getDiff } from "../src/git/getDiff"

const PORT = Number(process.env.PORT || 3000)

function summarizeDiff(diff: string) {
  if (!diff) return { text: "差分なし", files: [] }
  const lines = diff.split(/\r?\n/)
  const files: Record<string, { added: number; removed: number }> = {}
  let currentFile: string | null = null

  for (const line of lines) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (m) {
      currentFile = m[2]
      if (!files[currentFile]) files[currentFile] = { added: 0, removed: 0 }
      continue
    }
    if (!currentFile) continue
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue
    if (line.startsWith("+")) {
      files[currentFile].added += 1
    } else if (line.startsWith("-")) {
      files[currentFile].removed += 1
    }
  }

  const fileSummaries = Object.entries(files).map(([file, counts]) => ({
    file,
    added: counts.added,
    removed: counts.removed,
  }))

  const textLines = fileSummaries.map(f => `${f.file}: +${f.added} / -${f.removed}`)
  return { text: textLines.join("\n"), files: fileSummaries }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || "/"
    if (url === "/" || url === "/index.html") {
      const file = path.join(process.cwd(), "test_project", "index.html")
      const html = fs.readFileSync(file, "utf-8")
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    if (url === "/raw") {
      const diff = getDiff()
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
      res.end(diff)
      return
    }

    if (url === "/summary") {
      const diff = getDiff()
      const summary = summarizeDiff(diff)
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" })
      res.end(JSON.stringify(summary, null, 2))
      return
    }

    res.writeHead(404)
    res.end("Not found")
  } catch (e: any) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
    res.end(String(e.stack || e.message || e))
  }
})

server.listen(PORT, () => {
  console.log(`Server listening http://localhost:${PORT}`)
})

export {}
