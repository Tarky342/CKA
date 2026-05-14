# yoshida_zemi - プロジェクト解析レポート

**生成日時**: 2026-05-14T11:00:05.336Z

---

## Phase 1 - ファイル収集

- ファイル数: 38
- 総行数（推定）: 4136
- ファイルインベントリ: 38件

### サンプルインベントリ

| path | ext | size | lines | modified | encoding |
| --- | --- | ---: | ---: | --- | --- |
| .vscode\settings.json | .json | 310 | 8 | 2026-05-14T08:35:24.517Z | utf-8 |
| AST_ANALYSIS_IMPLEMENTATION.md | .md | 7553 | 268 | 2026-05-14T10:17:58.971Z | utf-8 |
| input\sample.js | .js | 0 | 0 | 2026-05-14T09:05:31.658Z | utf-8 |
| input\sample.ts | .ts | 0 | 0 | 2026-05-14T04:38:17.349Z | utf-8 |
| input\sample.txt | .txt | 1910 | 22 | 2026-05-14T05:31:17.432Z | utf-8 |
| output\portfolio-nfc-main_analysis_2026-05-14T10_50_23_197Z.md | .md | 1831 | 75 | 2026-05-14T10:50:23.197Z | utf-8 |
| output\portfolio-nfc-main_analysis_2026-05-14T10_51_05_847Z.md | .md | 1831 | 75 | 2026-05-14T10:51:05.851Z | utf-8 |
| output\portfolio-nfc-main_analysis_2026-05-14T10_52_56_431Z.md | .md | 1831 | 75 | 2026-05-14T10:52:56.430Z | utf-8 |

## Phase 2 - プロジェクト種別推定

- 判定: Generic
- 戦略:
  - 汎用静的解析として扱う

## Phase 3 - 依存関係カテゴリ解析

（カテゴリ化できる依存関係なし）

## Phase 4 - ディレクトリ構造解析

### トップレベルフォルダ

- src: 19 files
- test_project: 4 files
- input: 3 files
- output: 3 files
- .vscode: 1 files
- AST_ANALYSIS_IMPLEMENTATION.md: 1 files
- package-lock.json: 1 files
- package.json: 1 files
- README.md: 1 files
- TODO.md: 1 files
- tsconfig.json: 1 files
- 現状をまとめた.md: 1 files

### 重要フォルダ判定

- app: absent (0 files)
- components: absent (0 files)
- hooks: absent (0 files)
- lib: absent (0 files)
- services: absent (0 files)
- store: absent (0 files)
- api: absent (0 files)
- pages: absent (0 files)
- src: present (19 files)
- public: absent (0 files)
- features: absent (0 files)
- packages: absent (0 files)

## Phase 5 - AST解析

- 関数: 62個
- クラス: 0個
- インポート: 12個
- エクスポート: 8個
- TS: 13, JS: 10

## Phase 6 - 一次推論まとめ

- プロジェクト種別: Generic
- 依存関係カテゴリ数: 0
- 重要フォルダ検出数: 1
- AST 対象数: 5

## Phase 7 - 追加調査項目と該当元

## 追加調査項目と該当元

### クライアントコンポーネント依存調査

- ねらい: import 数のあるコンポーネント群が見えるため、use client の偏りを確認する
- 注目点: use client / metadata / page-layout-component graph
- 該当元:
  - （該当候補なし）

### 巨大ソースファイル再調査

- ねらい: テキストベースの大容量ファイルは実装責務の集中が起きやすいため、局所的に再読する
- 注目点: God component / large module / refactor candidate
- 該当元:
  - src\analyzeProjectMultiStep.ts
  - package-lock.json
  - README.md
  - src\analyzeAST.ts
  - 現状をまとめた2.md


## Phase 8 - 追加調査結果

## 追加調査結果

### use client / metadata / page-layout-component graph

- 要約: focus: use client / metadata / page-layout-component graph に対する明確な証拠は少ない

### God component / large module / refactor candidate

- 要約: focus: God component / large module / refactor candidate に対して 16 件の証拠を取得
- 対象ファイル:
  - src\analyzeProjectMultiStep.ts
  - package-lock.json
  - README.md
  - src\analyzeAST.ts
  - 現状をまとめた2.md
- 証拠:
  - src\analyzeProjectMultiStep.ts: use client = 5
  - src\analyzeProjectMultiStep.ts: metadata/generateMetadata = 35
  - src\analyzeProjectMultiStep.ts: next/image usage = 3
  - src\analyzeProjectMultiStep.ts: animation keyword hits = 5
  - src\analyzeProjectMultiStep.ts: 3D keyword hits = 8
  - src\analyzeProjectMultiStep.ts: sanity keyword hits = 7
  - src\analyzeProjectMultiStep.ts: snippet -> import * as fs from "fs/promises" import * as path from "path" import { analyzeStep0_AST } from "./analyzeAST.js" export interface AnalysisCache { projectName: string timestamp: string stats: { byExt: Record<string, { co
  - src\analyzeProjectMultiStep.ts: client component と metadata が同居している可能性
  - package-lock.json: snippet -> { "name": "code-knowledge-agent", "version": "0.1.0", "lockfileVersion": 3, "requires": true, "packages": { "": { "name": "code-knowledge-agent", "version": "0.1.0", "dependencies": { "simple-git": "^3.36.0", "zod": "^3.
  - README.md: use client = 1
  - README.md: metadata/generateMetadata = 1
  - README.md: animation keyword hits = 2


## Phase 9 - 統合評価

- 一次推論で抽出した構造情報に対し、追加調査で 16 件の証拠を回収した
- 解析は静的事実 → 追加ソース調査 → 統合評価 の順で進めた
- 次に実装すべきなのは、調査結果を受けた LLM 推論層とスコアリング層の切り出しである

## TODO / FIXME 抽出

- AST_ANALYSIS_IMPLEMENTATION.md#L99: Step 2: TODO 抽出
- AST_ANALYSIS_IMPLEMENTATION.md#L147: [Step 2] TODO/FIXME を抽出中...
- AST_ANALYSIS_IMPLEMENTATION.md#L160: | yoshida_zemi_full_todos.json | 1,523 bytes | TODO 一覧 |
- output\portfolio-nfc-main_analysis_2026-05-14T10_50_23_197Z.md#L40: ## TODO / FIXME 抽出（上限50件）
- output\portfolio-nfc-main_analysis_2026-05-14T10_51_05_847Z.md#L40: ## TODO / FIXME 抽出（上限50件）
- output\portfolio-nfc-main_analysis_2026-05-14T10_52_56_431Z.md#L40: ## TODO / FIXME 抽出（上限50件）
- README.md#L36: - TODO/FIXME の抽出
- README.md#L168: node dist/main.js step2 yoshida_zemi  # TODO抽出
- README.md#L179: | **Step 2** | TODO抽出 | `{project}_todos.json` | TODO/FIXME一覧 |
- README.md#L276: - 検出された TODO/FIXME
- README.md#L335: - TODO/FIXME の抽出は正規表現に基づくシンプルな検出です
- src\analyzeProject.ts#L93: if (/TODO|FIXME|BUG/.test(l)) {
- src\analyzeProject.ts#L134: md += `\n## TODO / FIXME 抽出（上限50件）\n\n`
- src\analyzeProjectMultiStep.ts#L587: console.log(`[Step 2] TODO/FIXME を抽出中...`)
- src\analyzeProjectMultiStep.ts#L606: if (/TODO|FIXME|BUG/.test(l)) {
- src\analyzeProjectMultiStep.ts#L617: console.log(`✅ TODO抽出結果をキャッシュ: ${todoFile} (${todos.length}件)`)
- src\analyzeProjectMultiStep.ts#L796: md += `\n## TODO / FIXME 抽出\n\n`
- src\analyzeProjectMultiStep.ts#L798: md += `（TODOなし）\n`
- src\main.ts#L23: step2      - [Step 2] TODO/FIXME抽出のみ
- TODO.md#L1: # 追加したい解析 TODO

## package.json 情報

- name: code-knowledge-agent
- version: 0.1.0
- dependencies:
  - zod: ^3.23.8

---

Generated by analyzeProject.ts (multi-step pipeline)
