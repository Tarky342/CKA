import * as fs from 'node:fs/promises';
import * as path from "path";
import { execSync } from "child_process";
import * as ts from "typescript";
import { fileURLToPath } from 'url';

// Replace __dirname with the following
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function walkDir(dir: string, ignore: Set<string>): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignore.has(entry.name)) continue;

    if (entry.isDirectory()) {
      const subFiles = await walkDir(fullPath, ignore);
      files.push(...subFiles);
    } else if (entry.isFile() && (/\.ts$|\.js$/.test(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

interface FunctionDef {
  name: string;
  type: "function" | "arrow" | "class-method";
  params: string[];
  returnType?: string;
  isAsync: boolean;
  isExport: boolean;
  line: number;
}

interface ClassDef {
  name: string;
  methods: FunctionDef[];
  isExport: boolean;
  line: number;
}

interface ImportInfo {
  module: string;
  items: string[];
  line: number;
}

interface CallGraph {
  caller: string;
  callees: string[];
}

interface ASTResult {
  file: string;
  language: "typescript" | "javascript";
  functions: FunctionDef[];
  classes: ClassDef[];
  imports: ImportInfo[];
  exports: string[];
  callGraph: CallGraph[];
  totalLines: number;
}

interface ProjectAST {
  files: ASTResult[];
  summary: {
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    totalExports: number;
    languages: { typescript: number; javascript: number };
  };
  dependencyGraph: Record<string, string[]>;
}

/**
 * TypeScript/JavaScriptファイルからAST情報を抽出
 */
async function extractAST(filePath: string): Promise<ASTResult | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const language = filePath.endsWith(".ts") ? "typescript" : "javascript";
    const lines = content.split("\n");

    const functions: FunctionDef[] = [];
    const classes: ClassDef[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const callGraph: CallGraph[] = [];

    // 関数定義を抽出
    const funcRegex = /(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)\s*(?:\([^)]*\)|\s*=\s*\([^)]*\))/g;
    let match;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 関数定義
      while ((match = funcRegex.exec(line)) !== null) {
        const name = match[1];
        const isExport = line.includes("export");
        const isAsync = line.includes("async");

        // パラメータ抽出
        const paramMatch = line.match(/\(([^)]*)\)/);
        const params = paramMatch ? paramMatch[1].split(",").map((p: string) => p.trim()) : [];

        // 戻り値型抽出 (TypeScript)
        const returnTypeMatch = line.match(/\):\s*([^{=;]+)/);
        const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : undefined;

        functions.push({
          name,
          type: line.includes("const") && line.includes("=>") ? "arrow" : "function",
          params,
          returnType,
          isAsync,
          isExport,
          line: i + 1,
        });
      }

      // クラス定義
      if (/(?:export\s+)?class\s+(\w+)/.test(line)) {
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        const className = classMatch?.[1] || "Unknown";
        const isExport = line.includes("export");

        const methods: FunctionDef[] = [];

        // クラス内のメソッドを抽出 (簡易版)
        for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
          const methodLine = lines[j];
          const methodMatch = methodLine.match(/(?:async\s+)?(\w+)\s*\([^)]*\)(?::\s*([^{]+))?/);
          if (methodMatch && !methodLine.includes("class ")) {
            methods.push({
              name: methodMatch[1],
              type: "class-method",
              params: [],
              returnType: methodMatch[2]?.trim(),
              isAsync: methodLine.includes("async"),
              isExport: false,
              line: j + 1,
            });
          }
          if (methodLine.trim() === "}" || /^\s*}/.test(methodLine)) break;
        }

        classes.push({
          name: className,
          methods,
          isExport,
          line: i + 1,
        });
      }

      // インポート定義
      if (/^import\s+/.test(line.trim())) {
        const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const items = importMatch[1]
            ? importMatch[1].split(",").map((item: string) => item.trim())
            : [importMatch[2] || "default"];
          const module = importMatch[3];
          imports.push({ module, items, line: i + 1 });
        }
      }

      // エクスポート定義
      if (/^export\s+(?:default\s+)?(?:function|class|const|interface|type)/.test(line.trim())) {
        const exportMatch = line.match(/export\s+(?:default\s+)?(?:function|class|const|interface|type)\s+(\w+)/);
        if (exportMatch) {
          exports.push(exportMatch[1]);
        }
      }
    }

    // 呼び出し関係を抽出 (簡易版)
    for (const func of functions) {
      const callees: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 同一ファイル内の関数呼び出しを検出
        for (const other of functions) {
          if (
            func.name !== other.name &&
            new RegExp(`\\b${other.name}\\s*\\(`).test(line)
          ) {
            if (!callees.includes(other.name)) {
              callees.push(other.name);
            }
          }
        }
      }
      if (callees.length > 0) {
        callGraph.push({ caller: func.name, callees });
      }
    }

    return {
      file: path.relative(process.cwd(), filePath),
      language,
      functions,
      classes,
      imports,
      exports,
      callGraph,
      totalLines: lines.length,
    };
  } catch (err) {
    console.warn(`⚠️  AST抽出失敗: ${filePath}`);
    return null;
  }
}

/**
 * プロジェクト全体のAST解析
 */
export async function analyzeStep0_AST(
  projectName: string,
  outputDir: string = "output"
): Promise<void> {
  try {
    console.log(`[Step 0] AST構造解析を開始...`);

    const cacheDir = path.join(outputDir, ".analysis_cache");
    await fs.mkdir(cacheDir, { recursive: true });

    const astFile = path.join(cacheDir, `${projectName}_ast.json`);

    // TypeScript/JavaScriptファイルを検索（Windows互換）
    const ignorePatterns = new Set([
      "node_modules",
      ".git",
      "dist",
      "output",
      ".next",
      ".vscode",
      "build",
    ]);
    const allFiles = await walkDir(".", ignorePatterns);
    const tsJsFiles = allFiles.filter((f) => /\.(ts|js)$/.test(f));

    const projectAST: ProjectAST = {
      files: [],
      summary: {
        totalFunctions: 0,
        totalClasses: 0,
        totalImports: 0,
        totalExports: 0,
        languages: { typescript: 0, javascript: 0 },
      },
      dependencyGraph: {},
    };

    // 各ファイルのAST解析
    for (const file of tsJsFiles.slice(0, 100)) {
      // 上限100ファイル
      const ast = await extractAST(file);
      if (ast) {
        projectAST.files.push(ast);

        projectAST.summary.totalFunctions += ast.functions.length;
        projectAST.summary.totalClasses += ast.classes.length;
        projectAST.summary.totalImports += ast.imports.length;
        projectAST.summary.totalExports += ast.exports.length;
        projectAST.summary.languages[ast.language]++;

        // 依存グラフを構築
        if (ast.imports.length > 0) {
          projectAST.dependencyGraph[ast.file] = ast.imports.map((imp) => imp.module);
        }
      }
    }

    // AST情報をキャッシュ保存
    await fs.writeFile(astFile, JSON.stringify(projectAST, null, 2));

    console.log(`✅ AST解析結果をキャッシュ: ${astFile}`);
    console.log(`   関数: ${projectAST.summary.totalFunctions}個`);
    console.log(`   クラス: ${projectAST.summary.totalClasses}個`);
    console.log(`   インポート: ${projectAST.summary.totalImports}個`);
    console.log(`   エクスポート: ${projectAST.summary.totalExports}個`);
    console.log(`   TS: ${projectAST.summary.languages.typescript}, JS: ${projectAST.summary.languages.javascript}`);
  } catch (err) {
    console.error("❌ Step 0 失敗:", err);
  }
}

/**
 * Analyze a TypeScript project and generate structured knowledge in JSONL format.
 */
async function analyzeProject(projectPath: string, outputPath: string) {
  const program = ts.createProgram([projectPath], {});
  const checker = program.getTypeChecker();

  const knowledgeUnits: any[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      ts.forEachChild(sourceFile, node => {
        const knowledgeUnit = extractKnowledgeUnit(node, checker);
        if (knowledgeUnit) {
          knowledgeUnits.push(knowledgeUnit);
        }
      });
    }
  }

  // Write knowledge units to JSONL file (async)
  const jsonlContent = knowledgeUnits.map(unit => JSON.stringify(unit)).join('\n');
  await fs.writeFile(outputPath, jsonlContent, 'utf-8');
  console.log(`Knowledge units written to ${outputPath}`);
}

/**
 * Extract a knowledge unit from a TypeScript node.
 */
function extractKnowledgeUnit(node: ts.Node, checker: ts.TypeChecker): any | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
        const symbol = checker.getSymbolAtLocation(node.name);
        const type = checker.getTypeAtLocation(node);

        return {
            type: 'Function',
            name: node.name.text,
            returnType: checker.typeToString(type.getCallSignatures()[0]?.getReturnType()),
            parameters: node.parameters.map(param => param.getText()),
            documentation: ts.displayPartsToString(symbol?.getDocumentationComment(checker))
        };
    }

    // Add more cases for other node types as needed
    return null;
}

// Example usage
const projectPath = path.resolve(__dirname, '../test_project/server.ts');
const outputPath = path.resolve(__dirname, '../output/knowledge.jsonl');
analyzeProject(projectPath, outputPath).catch(() => {});

// Example usage for portfolio-nfc-main
const portfolioProjectPath = path.resolve(__dirname, '../../../portfolio-nfc-main');
const portfolioOutputPath = path.resolve(__dirname, '../output/portfolio_knowledge.jsonl');
analyzeProject(portfolioProjectPath, portfolioOutputPath).catch(() => {});
