export function buildSummaryPrompt(content: string): string {
  return `
以下のgit diffを分析して、マークダウン形式の詳細な変更報告書を作成してください。

【出力形式】
- 変更ファイルごとに説明
- 各ファイルについて：
  - 何が変わったか（概要）
  - 追加された主な機能や改善
  - 削除された部分がある場合その理由
  - 影響を受ける可能性のあるコンポーネント
- 全体的な変更の意図と目的
- 注意点やリスク（ある場合）

【git diff】
${content}

マークダウン形式で、読みやすく構造化された報告書を作成してください。
`
}

export function buildReportTemplate(projectName: string, timestamp: string, diffSummary: string, modelName?: string): string {
  return `# ${projectName} - 変更報告書

**生成日時**: ${timestamp}
${modelName ? `\n**使用モデル**: ${modelName}` : ""}

---

## 概要

${diffSummary}

---

## メモ

このレポートはAI（Ollama）により自動生成されました。
内容の正確性を確認することを推奨します。
`
}