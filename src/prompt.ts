export function buildSummaryPrompt(content: string): string {
  return `
以下の内容を簡潔に要約してください。



${content}
`
}