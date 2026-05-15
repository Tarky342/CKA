/// <reference types="node" />
/// <reference lib="dom" />

import * as readline from "node:readline"

const DEFAULT_MODEL = "qwen2.5-coder:1.5b"
const OLLAMA_API_BASE = "http://localhost:11434"

export interface OllamaModelInfo {
  name: string
  size?: number
  modified_at?: string
  digest?: string
}

async function fetchInstalledModels(): Promise<OllamaModelInfo[]> {
  const response = await globalThis.fetch(`${OLLAMA_API_BASE}/api/tags`)

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.status}`)
  }

  const data = await response.json() as { models?: OllamaModelInfo[] }
  return Array.isArray(data.models) ? data.models : []
}

function formatModelLabel(model: OllamaModelInfo): string {
  const size = typeof model.size === "number" ? ` (${Math.round(model.size / 1024 / 1024)} MB)` : ""
  return `${model.name}${size}`
}

async function promptForModelSelection(models: OllamaModelInfo[], defaultModel: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return defaultModel
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  try {
    console.log("利用可能な Ollama モデルを検出しました。")
    models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${formatModelLabel(model)}`)
    })

    const answer = await new Promise<string>(resolve => {
      rl.question(`使用するモデル番号を入力してください [${defaultModel}]: `, resolve)
    })
    const trimmed = answer.trim()

    if (!trimmed) {
      return defaultModel
    }

    const numericChoice = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= models.length) {
      return models[numericChoice - 1].name
    }

    const byName = models.find(model => model.name === trimmed)
    if (byName) {
      return byName.name
    }

    console.warn(`不明な入力のため既定値を使用します: ${defaultModel}`)
    return defaultModel
  } finally {
    rl.close()
  }
}

function formatInstallHint(modelName: string): string {
  return [
    "Ollama または指定モデルが利用できません。",
    "必要な手順:",
    "1. Ollama をインストールする: https://ollama.com",
    "2. サーバーを起動する: ollama serve",
    `3. モデルを追加する: ollama pull ${modelName}`
  ].join("\n")
}

export async function resolveModel(preferredModel?: string): Promise<string> {
  let models: OllamaModelInfo[]

  try {
    models = await fetchInstalledModels()
  } catch (error) {
    throw new Error(`${formatInstallHint(preferredModel?.trim() || DEFAULT_MODEL)}\n\n詳細: ${(error as Error).message}`)
  }

  if (models.length === 0) {
    throw new Error(formatInstallHint(preferredModel?.trim() || DEFAULT_MODEL))
  }

  const requestedModel = preferredModel?.trim()
  if (requestedModel) {
    const matchedModel = models.find(model => model.name === requestedModel)
    if (matchedModel) {
      return matchedModel.name
    }

    throw new Error([
      `指定されたモデル "${requestedModel}" はインストールされていません。`,
      `利用可能なモデル: ${models.map(model => model.name).join(", ") || "-"}`,
      `追加する場合は: ollama pull ${requestedModel}`
    ].join("\n"))
  }

  if (models.length === 1) {
    return models[0].name
  }

  const defaultModel = models.find(model => model.name === DEFAULT_MODEL)?.name || models[0].name
  return promptForModelSelection(models, defaultModel)
}

export async function generate(prompt: string, model: string): Promise<string> {
  const response = await globalThis.fetch(`${OLLAMA_API_BASE}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
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