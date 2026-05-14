import { execSync } from "child_process"

export function getDiff(): string {
  const diff = execSync("git diff", { encoding: "utf-8" })
  return diff
}

// test change: add a comment to create an uncommitted diff for testing
// (この行はテスト後に元に戻してください)
// test change 2: second line to create an uncommitted change
