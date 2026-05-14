import { generateDiffReport } from "./generateReport.js"
import { analyzeProject } from "./analyzeProject.js"
import { analyzeProjectFull, analyzeStep1_Scan, analyzeStep2_ExtractTodos, analyzeStep3_ExtractMetadata, analyzeStep4_GenerateReport } from "./analyzeProjectMultiStep.js"
import { analyzeStep0_AST } from "./analyzeAST.js"

function showHelp() {
  console.log(`
使用方法:
  node dist/main.js <command> [projectDir] [outputDir]

【基本コマンド】
  diff       - 差分解析のみ（未コミット変更をレポート）
  analyze    - 全体解析のみ（プロジェクト構造を解析）
  both       - 両方実行（差分 + 全体解析）

【マルチステップ版（大規模プロジェクト向け）】
  analyze-ms - 全体解析（メモリ効率重視・複数ステップで実行）
  both-ms    - 両方実行（マルチステップ版）

【ステップ個別実行】
  step0      - [Step 0] AST構造解析（関数・クラス・依存関係抽出）
  step1      - [Step 1] ファイルスキャンのみ
  step2      - [Step 2] TODO/FIXME抽出のみ
  step3      - [Step 3] メタデータ抽出のみ
  step4      - [Step 4] 最終レポート生成

【その他】
  help       - このメッセージを表示

実行例:
  node dist/main.js diff /path/to/project
  node dist/main.js analyze /path/to/project
  node dist/main.js analyze-ms /path/to/project           # マルチステップ版
  node dist/main.js both ./my_project
  node dist/main.js step0 ./my_project                    # AST解析のみ
  node dist/main.js step1 ./my_project                    # ステップ1のみ
  node dist/main.js step4 ./my_project                    # ステップ4のみ

マルチステップ版について:
  結果は output/.analysis_cache/ に保存されます。
  メモリ効率が良く、大規模プロジェクト向けです。
  Step 0 (AST解析) は automatically run により自動実行されます。
`)
}

async function main() {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === "help") {
    showHelp()
    return
  }

  const command = argv[0]
  const projectDir = argv[1]
  const outputDir = argv[2] || "output"

  const validCommands = ["diff", "analyze", "both", "analyze-ms", "both-ms", "step0", "step1", "step2", "step3", "step4"]
  
  if (!validCommands.includes(command)) {
  // ステップ個別実行
  if (command === "step0") {
    await analyzeStep0_AST(projectDir, outputDir)
    return
  }

    console.error(`❌ 不正なコマンド: ${command}`)
    console.error(`使用可能: ${validCommands.join(", ")}, help`)
    showHelp()
    process.exit(1)
  }

  if (!projectDir && command !== "help") {
    console.error(`❌ プロジェクトディレクトリが必要です`)
    showHelp()
    process.exit(1)
  }

  // 基本コマンド
  if (command === "diff") {
    console.log(`📊 差分解析を実行中...`)
    const reportPath = await generateDiffReport({ projectDir, outputDir })
    if (reportPath) {
      console.log(`✅ 差分レポート保存: ${reportPath}`)
    }
    return
  }

  if (command === "analyze") {
    console.log(`🔍 プロジェクト全体解析を実行中...`)
    const analysisPath = await analyzeProject({ projectDir, outputDir })
    console.log(`✅ 解析レポート保存: ${analysisPath}`)
    return
  }

  if (command === "both") {
    console.log(`📊 差分解析を実行中...`)
    const reportPath = await generateDiffReport({ projectDir, outputDir })
    if (reportPath) {
      console.log(`✅ 差分レポート保存: ${reportPath}`)
    }
    console.log(`🔍 プロジェクト全体解析を実行中...`)
    const analysisPath = await analyzeProject({ projectDir, outputDir })
    console.log(`✅ 解析レポート保存: ${analysisPath}`)
    return
  }

  // マルチステップコマンド
  if (command === "analyze-ms") {
    const reportPath = await analyzeProjectFull(outputDir, projectDir)
    console.log(`✅ マルチステップ解析完了: ${reportPath}`)
    return
  }

  if (command === "both-ms") {
    console.log(`📊 差分解析を実行中...`)
    const reportPath = await generateDiffReport({ projectDir, outputDir })
    if (reportPath) {
      console.log(`✅ 差分レポート保存: ${reportPath}`)
    }
    const analyzeReportPath = await analyzeProjectFull(outputDir, projectDir)
    console.log(`✅ マルチステップ解析完了: ${analyzeReportPath}`)
    return
  }

  // ステップ個別実行
  if (command === "step1") {
    await analyzeStep1_Scan(outputDir, projectDir)
    return
  }

  if (command === "step2") {
    await analyzeStep2_ExtractTodos(outputDir, projectDir)
    return
  }

  if (command === "step3") {
    await analyzeStep3_ExtractMetadata(outputDir, projectDir)
    return
  }

  if (command === "step4") {
    const reportPath = await analyzeStep4_GenerateReport(outputDir, projectDir)
    console.log(`✅ レポート生成完了: ${reportPath}`)
    return
  }
}

main().catch(console.error)