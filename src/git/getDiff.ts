import { execSync } from "child_process"
import * as path from "path"

export function getDiff(projectDir?: string): string {
  const cwd = projectDir ? path.resolve(projectDir) : undefined
  const diff = execSync("git diff", { encoding: "utf-8", cwd })
  return diff
}

// test change: add a comment to create an uncommitted diff for testing
// (この行はテスト後に元に戻してください)
// test change 2: second line to create an uncommitted change
