const MODEL = "qwen2.5-coder:1.5b"

export async function generate(prompt: string): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.status}`)
  }

  const data = await response.json() as any

  return data.response
}