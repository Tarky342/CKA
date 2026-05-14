const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PORT = Number(process.env.PORT || 3000)

function getDiff() {
  try {
    return execSync('git diff', { encoding: 'utf-8' })
  } catch (e) {
    return String(e && e.stdout) || ''
  }
}

function summarizeDiff(diff) {
  if (!diff) return { text: '差分なし', files: [] }
  const lines = diff.split(/\r?\n/)
  const files = {}
  let currentFile = null

  for (const line of lines) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (m) {
      currentFile = m[2]
      if (!files[currentFile]) files[currentFile] = { added: 0, removed: 0 }
      continue
    }
    if (!currentFile) continue
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
    if (line.startsWith('+')) {
      files[currentFile].added += 1
    } else if (line.startsWith('-')) {
      files[currentFile].removed += 1
    }
  }

  const fileSummaries = Object.keys(files).map(file => ({ file, added: files[file].added, removed: files[file].removed }))
  const textLines = fileSummaries.map(f => `${f.file}: +${f.added} / -${f.removed}`)
  return { text: textLines.join('\n'), files: fileSummaries }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/'
    if (url === '/' || url === '/index.html') {
      const file = path.join(process.cwd(), 'test_project', 'index.html')
      const html = fs.readFileSync(file, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (url === '/raw') {
      const diff = getDiff()
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(diff)
      return
    }

    if (url === '/summary') {
      const diff = getDiff()
      const summary = summarizeDiff(diff)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(summary, null, 2))
      return
    }

    if (url === '/report') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ status: 'report generation requires ollama', available: '/summary, /raw' }))
      return
    }

    res.writeHead(404)
    res.end('Not found')
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(String(e && e.stack))
  }
})

server.listen(PORT, () => {
  console.log(`Server listening http://localhost:${PORT}`)
})

module.exports = {}
