import express, { Request, Response } from "express"
import fs from "node:fs/promises"
import path from "node:path"
import { generate } from "./ollama.js"

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333
const FACTS_DIR = path.resolve(process.cwd(), "output", "facts")

async function loadFacts() {
  const facts: any[] = []
  try {
    const files = await fs.readdir(FACTS_DIR)
    for (const f of files) {
      const full = path.join(FACTS_DIR, f)
      const txt = await fs.readFile(full, "utf-8")
      for (const line of txt.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          facts.push(JSON.parse(line))
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // directory may not exist
  }
  return facts
}

function searchFacts(facts: any[], q: string, top = 5) {
  const scores = facts.map(f => {
    const s = JSON.stringify(f).toLowerCase().split(q.toLowerCase()).length - 1
    return { f, s }
  })
  return scores.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, top).map(x => x.f)
}

async function main() {
  const app = express()
  app.use(express.json())

  let facts = await loadFacts()

  app.get("/health", (req: Request, res: Response) => res.json({ ok: true, facts: facts.length }))

  app.get("/search", (req: Request, res: Response) => {
    const q = String((req.query.q as string) || "").trim()
    if (!q) return res.status(400).json({ error: "q required" })
    const results = searchFacts(facts, q)
    res.json({ query: q, hits: results.length, results })
  })

  app.post("/qa", async (req: Request, res: Response) => {
    const question = String(req.body.question || "").trim()
    if (!question) return res.status(400).json({ error: "question required" })

    // simple retrieval
    const hits = searchFacts(facts, question, 10)
    const context = hits.slice(0, 6).map(h => JSON.stringify(h)).join('\n')

    const prompt = `You are a helpful assistant. Use ONLY the provided CONTEXT to answer the question.\nCONTEXT:\n${context}\n\nQUESTION:\n${question}\n\nAnswer concisely.`

    try {
      const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:1.5b"
      const answer = await generate(prompt, model)
      res.json({ answer, context: hits })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.post("/reload", async (req: Request, res: Response) => {
    facts = await loadFacts()
    res.json({ ok: true, facts: facts.length })
  })

  app.listen(PORT, () => {
    console.log(`QA server running on http://localhost:${PORT}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
