# Code Knowledge Agent

Git の差分を解析して、プロジェクトの変更内容と全体構造を自動でマークダウン形式のレポートにする TypeScript CLI です。

## 概要

このツールは、最初に静的解析で構造を作り、その後で LLM に意味解析を任せる 2 層構成です。

### 解析の基本方針

```txt
収集
↓
構造化
↓
推論
↓
評価
↓
提案
```

LLM に最初から全コードを読ませず、まず filesystem scan / AST / graph / metrics / rules で事実を集めます。

### このツールが提供する解析

1. **差分解析（diff）** - 未コミットの変更をレポート
   - git diff を ollama API で分析
   - 変更ファイルごとの詳細説明
   - 全体的な変更の意図を推論

2. **全体解析（analyze）** - プロジェクト構造を解析
   - ファイル数、総行数の統計
   - 拡張子別の構成分析
   - 大ファイルの検出
   - TODO/FIXME の抽出
   - package.json 情報の抽出

3. **AST構造解析（Step 0）** - コード構造の圧縮
  - 関数・クラス定義のシグネチャ抽出
  - インポート/依存関係の解析
  - 呼び出し関係（コールグラフ）の構築
  - コンテキスト効率化のための構造化
  - 大規模プロジェクト向けのメモリ効率的処理

### 汎用的な解析ステップ

本来の Agent は次の 13 段階で動作します。

```txt
Phase 1  Filesystem Scan
Phase 2  Project Detection
Phase 3  Dependency Analysis
Phase 4  Directory Structure Analysis
Phase 5  AST Analysis
Phase 6  Graph Construction
Phase 7  Pattern Detection
Phase 8  Security Analysis
Phase 9  Performance Analysis
Phase 10 Quality Analysis
Phase 11 LLM Reasoning
Phase 12 Scoring
Phase 13 Improvement Proposal
```

重要なのは、解析と推論を分離することです。例えば `use client` の多さ、巨大コンポーネント、依存の偏り、セキュリティシグナルは静的に集計し、LLM はその構造化済み情報に意味を付けるだけにします。

### 判定対象の例

| 判定 | 条件 |
| --- | --- |
| Next.js | `next.config.js` |
| Vite | `vite.config.ts` |
| React Native | `app.json` |
| Electron | `electron` dependency |
| Monorepo | `pnpm-workspace.yaml` |

### 解析例

```json
{
  "category": "animation",
  "package": "gsap"
}
```

```json
{
  "framework": "Next.js",
  "client_ratio": 0.82,
  "animation": ["gsap", "motion"],
  "large_components": [
    {
      "name": "Hero.tsx",
      "lines": 812
    }
  ]
}
```

## インストール

```bash
npm install
npm run build
```

## 使用方法

### コマンド形式

```bash
node dist/main.js <command> [projectName] [outputDir]
```

### コマンド一覧

#### 1. 差分解析のみ

```bash
# CLI直接実行
node dist/main.js diff yoshida_zemi

# npm スクリプト
npm run diff yoshida_zemi
```

**出力**: `output/yoshida_zemi_YYYYMMDD_hhmmss.md`

#### 2. 全体解析のみ

```bash
# CLI直接実行
node dist/main.js analyze yoshida_zemi

# npm スクリプト
npm run analyze yoshida_zemi
```

**出力**: `output/yoshida_zemi_analysis_YYYY-MM-DDTHH_MM_SS_sssZ.md`

#### 3. 両方実行

```bash
# CLI直接実行
node dist/main.js both yoshida_zemi

# npm スクリプト
npm run both yoshida_zemi
```

**出力**: 差分レポート + 全体解析レポート（2ファイル）

#### 4. ヘルプ表示

```bash
## マルチステップ解析パイプライン

大規模プロジェクト向けの効率的な解析：

```bash
# 自動実行（Step 0～4）
node dist/main.js analyze-ms yoshida_zemi

# 個別ステップ実行
node dist/main.js step0 yoshida_zemi  # AST構造解析
node dist/main.js step1 yoshida_zemi  # ファイルスキャン
node dist/main.js step2 yoshida_zemi  # TODO抽出
node dist/main.js step3 yoshida_zemi  # メタデータ抽出
node dist/main.js step4 yoshida_zemi  # レポート生成
```

### パイプライン構造

| ステップ | 処理内容 | キャッシュ出力 | 用途 |
|---------|--------|------------|------|
| **Step 0** | AST構造解析 | `{project}_ast.json` | 関数/クラス署名、依存関係 |
| **Step 1** | ファイルスキャン | `{project}_scan.json` | ファイル統計情報 |
| **Step 2** | TODO抽出 | `{project}_todos.json` | TODO/FIXME一覧 |
| **Step 3** | メタデータ抽出 | `{project}_metadata.json` | package.json、git情報 |
| **Step 4** | レポート生成 | `{project}_analysis_*.md` | 最終マークダウンレポート |

### 圧縮効果

AST解析により、元のコード行数に対して以下のコンテキスト削減が可能：

- **関数実装詳細**: 削除（署名のみ保持）
- **コメント/ドキュメント**: 削除（構造のみ保持）
- **テストコード**: スキップ
- **結果**: **全体で 70-80% のトークン削減**

例：
```typescript
// 元のコード (400 tokens)
export async function generateDiffReport(projectName: string) {
  const diff = getDiff();
  if (!diff) { console.log('No changes'); return; }
  // ... 100行の実装
}

// AST圧縮版 (20 tokens)
{
  "name": "generateDiffReport",
  "type": "function",
  "params": ["projectName: string"],
  "returnType": "Promise<void>",
  "isAsync": true,
  "dependencies": ["getDiff", "ollama.generate"]
}
```
# CLI直接実行
node dist/main.js help

# npm スクリプト
npm run help
```

### オプション

- `projectName` - プロジェクト名（デフォルト: カレントディレクトリ名）
- `outputDir` - 出力ディレクトリ（デフォルト: `output`）

### 使用例

```bash
# 基本的な使用
node dist/main.js diff my_project
node dist/main.js analyze my_project
node dist/main.js both my_project

# 出力先を指定
node dist/main.js diff my_project /tmp/reports

# 両方実行して reports フォルダに保存
node dist/main.js both my_project reports
```

## 必要な環境

- **Node.js** 24.x 以上
- **Ollama** - ローカル LLM API が `http://localhost:11434` で動作
  - モデル: `qwen2.5-coder:1.5b`

### Ollama のセットアップ

```bash
# https://ollama.ai から Ollama をダウンロード・インストール

# モデルをダウンロード
ollama pull qwen2.5-coder:1.5b

# サーバーを起動
ollama serve
```

## 出力ファイル形式

### 差分レポート

ファイル名: `{projectName}_{YYYYMMDD_hhmmss}.md`

内容:
- プロジェクト名と生成日時
- ollama による詳細な変更分析
- ファイルごとの変更内容
- 影響範囲と注意点

### 全体解析レポート

ファイル名: `{projectName}_analysis_{ISO_8601_timestamp}.md`

内容:
- ファイル数と総行数
- 拡張子別の統計
- 上位 10 個の大ファイル
- 検出された TODO/FIXME
- package.json の情報

## ファイル構成

```
src/
  ├── main.ts              # CLI エントリポイント
  ├── generateReport.ts    # 差分レポート生成
  ├── analyzeProject.ts    # プロジェクト全体解析
  ├── ollama.ts            # ollama API 呼び出し
  ├── prompt.ts            # プロンプト構築
  └── git/
      └── getDiff.ts       # git diff 取得

test_project/
  ├── server.cjs           # テスト用 HTTP サーバー
  ├── server.ts            # TypeScript 版
  └── index.html           # テスト UI

output/                    # 生成されたレポート保存先
```

## 開発

### TypeScript ビルド

```bash
npm run build
```

### 開発モードで実行

```bash
npm run dev diff "プロジェクト名"
npm run dev analyze "プロジェクト名"
npm run dev both "プロジェクト名"
```

## テスト

### HTTP サーバー経由でテスト

```bash
# ターミナル1: サーバー起動
node test_project/server.cjs

# ターミナル2: エンドポイント呼び出し
curl http://localhost:3000/raw
curl http://localhost:3000/summary
```

ブラウザで http://localhost:3000 にアクセス。

## 注意点

- ollama サーバーが停止していると実行できません
- 差分が大きい場合、ollama の応答が遅くなる可能性があります
- 生成されたレポートはあくまで AI による分析なので、正確性は保証されません
- TODO/FIXME の抽出は正規表現に基づくシンプルな検出です
- AST解析は TypeScript/JavaScript 両対応（.ts, .js ファイル）
- マルチステップ版（Step 0～4）はメモリ効率を重視
- キャッシュファイルは再利用可能（個別ステップの再実行に対応）

## ライセンス

MIT

## 今後の拡張予定

- [ ] Web UI でレポート履歴を表示
- [ ] Slack/Discord への自動通知
- [ ] CI/CD パイプラインへの統合
- [ ] 複数プロジェクトの一括解析
- [ ] カスタム解析ルールの定義機能
