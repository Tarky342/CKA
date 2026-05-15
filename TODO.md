
> 「解析Agent」と「説明/執筆Agent」を分離する

ここです。

つまり将来的には：

```txt
Codebase
 ↓
Static Analyzer
 ↓
Structured Knowledge(JSONL)
 ↓
Reasoning Agents
 ↓
Docs / Q&A / Refactor / Architecture Proposal
```

という「知識基盤」に変わります。

その場合、JSON は「レポート形式」ではなく、

* 検索しやすい
* 差分更新しやすい
* embedding しやすい
* graph 化しやすい
* LLM が部分読込しやすい

構造にする必要があります。

---

# 結論

Markdown レポートをやめるなら、

## 「1行 = 1知識単位(JSONL)」

に寄せるのが正しいです。

ただし重要なのは：

# 「何を1単位にするか」

です。

---

# 推奨アーキテクチャ

おすすめは：

```txt
facts/
  filesystem.jsonl
  symbols.jsonl
  imports.jsonl
  calls.jsonl
  packages.jsonl
  diagnostics.jsonl
  patterns.jsonl
  security.jsonl
  metrics.jsonl
```

つまり：

# 「責務別 JSONL」

です。

---

# なぜ分けるべきか

例えば：

## 悪い例

```json
{
  "file": "Hero.tsx",
  "imports": [],
  "functions": [],
  "todos": [],
  "security": [],
  "performance": []
}
```

これは後で崩壊します。

理由：

* 更新単位が大きい
* embedding しづらい
* 部分変更に弱い
* graph 化しづらい
* index 作成が困難

---

# 良い設計

## filesystem.jsonl

```json
{
  "type": "file",
  "path": "src/Hero.tsx",
  "ext": ".tsx",
  "size": 18231,
  "lines": 812
}
```

---

## symbols.jsonl

関数/クラス/変数定義。

```json
{
  "type": "function",
  "id": "symbol:Hero.renderParticles",
  "file": "src/Hero.tsx",
  "name": "renderParticles",
  "export": true,
  "async": false,
  "params": [
    "count:number"
  ],
  "returnType": "JSX.Element",
  "startLine": 120,
  "endLine": 188
}
```

---

## imports.jsonl

```json
{
  "type": "import",
  "from": "src/Hero.tsx",
  "to": "gsap",
  "kind": "package"
}
```

---

## calls.jsonl

コールグラフ。

```json
{
  "type": "call",
  "caller": "symbol:Hero.renderParticles",
  "callee": "gsap.timeline"
}
```

---

## patterns.jsonl

LLM前の静的推論。

```json
{
  "type": "pattern",
  "category": "animation",
  "signal": "gsap",
  "confidence": 0.93,
  "files": [
    "src/Hero.tsx"
  ]
}
```

---

## metrics.jsonl

```json
{
  "type": "component_metric",
  "file": "src/Hero.tsx",
  "lines": 812,
  "hooks": 14,
  "useClient": true,
  "jsxDepth": 9
}
```

---

# 最重要

## 「推論」を JSON に混ぜすぎない

これは非常に大事です。

例えば：

---

# NG

```json
{
  "architecture": "This project is badly designed"
}
```

これは死にます。

理由：

* 主観
* モデル依存
* 更新不能
* 再利用不能

---

# 良い

```json
{
  "type": "signal",
  "signal": "large_component",
  "file": "src/Hero.tsx",
  "lines": 812,
  "threshold": 300
}
```

つまり：

# 「事実」と「解釈」を分離

します。

---

# 将来の「質問できる技術書」に必要な構造

将来的に必要になるのは：

```txt
Entity
Relationship
Evidence
```

です。

つまり実質：

# 軽量 Knowledge Graph

になります。

---

# 推奨 JSON Schema

最低限これを全 JSONL に共通化すると強いです。

```json
{
  "id": "unique-id",
  "type": "symbol",
  "project": "my-project",
  "file": "src/foo.ts",
  "createdAt": "2026-05-15T10:00:00Z",
  "version": "git-sha",
  "data": {}
}
```

中身を `data` に寄せる。

---

# 実は超重要な設計

## 「座標」を持たせる

あとで Agent が使いやすくなる。

---

## 例

```json
{
  "id": "symbol:auth.login",
  "type": "function",
  "file": "src/auth.ts",
  "startLine": 20,
  "endLine": 88,
  "hash": "sha256..."
}
```

これで：

* 差分追跡
* embedding 更新
* blame
* code navigation
* RAG

全部できる。

---

# 次段階で絶対必要になるもの

## 1. stable id

関数名変更でも追跡したい。

なので：

```txt
path + signature hash
```

を推奨。

---

## 2. evidence

推論には必ず根拠。

```json
{
  "type": "finding",
  "category": "performance",
  "severity": "medium",
  "evidence": [
    "signal:large_component",
    "metric:jsx_depth"
  ]
}
```

これがないと AI が hallucination 化します。

---

# Agent 分離後の理想構成

かなり理想的なのは：

```txt
collector-agent
  ↓
normalizer-agent
  ↓
graph-builder-agent
  ↓
reasoning-agent
  ↓
writer-agent
```

です。
推奨プロンプト思想

各 Agent は：

Input
↓
Transformation
↓
Structured Output

だけに限定します。
推奨プロンプト構造

毎回これで統一すると強いです。

ROLE
INPUT
TASK
RULES
OUTPUT_SCHEMA

RULES を強くする

Agent は自由にすると壊れます。

なので：

DO NOT:
- speculate
- explain basics
- generate prose
- infer without evidence

を強めに書く。