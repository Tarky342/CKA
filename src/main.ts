import fs from "fs/promises"
import { generate } from "./ollama.js"
import { buildSummaryPrompt } from "./prompt"
import { getDiff } from "./git/getDiff.js"

async function main() {
  const outputPath = process.argv[2] || "output/summary.md"

  const diff = getDiff()

  const prompt = buildSummaryPrompt(diff)

  const summary = await generate(prompt)

  await fs.writeFile(outputPath, summary)

  console.log("done")
}

main()