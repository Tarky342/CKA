import { execFileSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

function resolveProjectDir(projectDir?: string): string | undefined {
  if (!projectDir) {
    return undefined
  }

  const cwd = path.resolve(projectDir)

  if (!fs.existsSync(cwd)) {
    throw new Error([
      `プロジェクトディレクトリが見つかりません: ${cwd}`,
      "存在するディレクトリを指定してください。"
    ].join("\n"))
  }

  const stat = fs.statSync(cwd)
  if (!stat.isDirectory()) {
    throw new Error([
      `指定されたパスはディレクトリではありません: ${cwd}`,
      "プロジェクトルートのディレクトリを指定してください。"
    ].join("\n"))
  }

  return cwd
}

function resolveGitExecutable(): string {
  const candidates = [
    process.env.GIT_EXECUTABLE,
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe",
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    "C:\\Program Files (x86)\\Git\\bin\\git.exe"
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)

  for (const candidate of candidates) {
    if (candidate === "git") {
      try {
        execFileSync(candidate, ["--version"], { encoding: "utf-8" })
        return candidate
      } catch {
        continue
      }
    }

    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error([
    "git が見つかりません。",
    "Git for Windows をインストールし、再度実行してください。",
    "https://git-scm.com/download/win",
    "インストール後も見つからない場合は、PATH に git.exe を追加するか、GIT_EXECUTABLE 環境変数でフルパスを指定してください。"
  ].join("\n"))
}

export function getDiff(projectDir?: string): string {
  const cwd = resolveProjectDir(projectDir)
  const gitExecutable = resolveGitExecutable()

  if (cwd) {
    try {
      execFileSync(gitExecutable, ["rev-parse", "--is-inside-work-tree"], {
        encoding: "utf-8",
        cwd
      })
    } catch {
      throw new Error([
        `指定されたディレクトリは Git リポジトリではありません: ${cwd}`,
        "git diff を実行するには、Git 管理下のプロジェクトを指定してください。"
      ].join("\n"))
    }
  }

  try {
    const diff = execFileSync(gitExecutable, ["diff"], { encoding: "utf-8", cwd })
    return diff
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error([
        "git diff の実行に失敗しました。",
        cwd ? `対象ディレクトリ: ${cwd}` : "対象ディレクトリが指定されていません。",
        "Git のインストール状態と、指定したプロジェクトディレクトリを確認してください。"
      ].join("\n"))
    }

    throw error
  }
}

// test change: add a comment to create an uncommitted diff for testing
// (この行はテスト後に元に戻してください)
// test change 2: second line to create an uncommitted change
