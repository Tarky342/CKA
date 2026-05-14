# 追加したい解析 TODO

対象レポート: `output/portfolio-nfc-main_analysis_2026-05-14T10_51_05_847Z.md`

このレポートを見る限り、現状はファイル数・行数・大きいファイル・package.json の一覧は取れているが、プロジェクトの意味構造までは十分に見えていない。特に `portfolio-nfc-main` は Next.js / 画像資産 / 3D / アニメーション / Sanity を含む構成なので、静的解析をもう一段深くする価値が高い。

## 優先度 High

### 1. プロジェクト種別の自動判定

- `next.config.js` / `next.config.mjs` / `next.config.ts` の検出
- `app/` と `pages/` の判定
- `sanity.config.*` の検出
- `three` / `@react-three/*` の有無を見て 3D 系プロジェクトを判定
- `gsap` / `motion` / `lenis` の有無を見て UI アニメーション重視を判定

### 2. 依存関係のカテゴリ化

- framework
- animation
- state management
- database / CMS
- auth
- testing
- 3D / graphics

`portfolio-nfc-main` では `next`, `react`, `@react-three/*`, `gsap`, `motion`, `sanity`, `sharp` をカテゴリ別にまとめる。

### 3. ディレクトリ構造の意味解析

- `app/`, `components/`, `hooks/`, `lib/`, `services/`, `store/`, `api/` の有無を判定
- `public/` 配下の画像資産を別カテゴリとして扱う
- `参照サイト/` のような設計参考フォルダを検出する
- トップレベルフォルダの役割を推論する

### 4. 画像・アセット解析

- 画像ファイルのサイズ一覧だけでなく、用途別に分類する
- `public/NameCard/` と `public/networkIMG/` のような資産群を論理グループ化する
- WebP / PNG / JPG / SVG の使い分けを評価する
- `next/image` の使用率を推定する
- 重い画像の圧縮候補を提案する

## 優先度 Medium

### 5. React / Next.js 構造解析

- `use client` の割合を算出する
- `metadata` / `generateMetadata` / `layout` / `page` の検出
- App Router のルート一覧を生成する
- コンポーネントツリーを推定する
- `Hero`, `Footer`, `Navbar` などの大きいコンポーネントを抽出する

### 6. AST と import graph の構築

- import 依存グラフを作る
- export 一覧を作る
- 関数・コンポーネント・フックのシグネチャだけを残す
- 同一ファイル内呼び出しではなく、ファイル横断の依存を可視化する

### 7. パフォーマンス解析

- 大きいコンポーネントの検出
- クライアントコンポーネント偏重の検出
- 3D / animation の bundle heavy な箇所の推定
- `sharp` / `next/image` の使い方から画像最適化余地を出す

### 8. 品質解析

- `any` の使用率
- `console.log` の残存数
- `eslint-disable` / `ts-ignore` の検出
- ネスト深度や複雑度の概算
- テストファイルの有無とカバレッジの入口確認

## 優先度 Low

### 9. セキュリティ解析

- `dangerouslySetInnerHTML`
- `eval(`
- `.env` / `process.env` の扱い
- 秘密文字列っぽい値の検出

### 10. LLM 推論の前処理

- まず静的解析結果を JSON にまとめる
- LLM に渡すのは要約済みの事実だけにする
- 例: `client_ratio`, `large_components`, `dependency_categories`, `asset_groups`

### 11. スコアリングと提案生成

- Architecture
- Performance
- Security
- Maintainability
- Accessibility

最後に「問題 → 原因 → 修正方法 → 影響」の形式で改善提案を出す。

## `portfolio-nfc-main` 固有で追加したい観点

- 3D 表示の責務分離ができているか
- アニメーションライブラリの重複利用がないか
- Sanity と UI の責務分離ができているか
- `public/` の画像が過剰に大きくないか
- 参照サイトと実装の乖離があるか
- App Router で SSR の恩恵を受けられているか

## 実装順のおすすめ

1. プロジェクト種別判定
2. 依存関係のカテゴリ化
3. ディレクトリ構造解析
4. 画像・アセット解析
5. AST / import graph
6. パターン検出
7. パフォーマンス解析
8. 品質・セキュリティ解析
9. LLM 推論と提案生成
