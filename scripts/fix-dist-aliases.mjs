import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const DIST_ROOT = path.resolve(process.cwd(), "dist");
const MAIN_OUT_DIR = path.join(DIST_ROOT, "main");

const ALIASES = [
  {
    alias: "@shared",
    targetDir: path.join(DIST_ROOT, "shared")
  }
];

const SUPPORTED_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".d.ts", ".d.mts", ".d.cts"]);
const RUNTIME_EXTENSIONS = [".js", ".mjs", ".cjs"];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(entryPath);
      }
      if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
        return [];
      }
      return [entryPath];
    })
  );
  return files.flat();
}

function resolveAlias(specifier, sourceFile, targetExt) {
  for (const { alias, targetDir } of ALIASES) {
    if (!specifier.startsWith(alias)) {
      continue;
    }

    const rest = specifier.slice(alias.length).replace(/^\//, "");
    let resolvedBase = rest.length > 0 ? path.join(targetDir, rest) : path.join(targetDir, "index");
    const currentExt = path.extname(resolvedBase);

    if (currentExt.length === 0) {
      resolvedBase = `${resolvedBase}${targetExt}`;
    } else if (targetExt === ".d.ts" && currentExt !== targetExt) {
      resolvedBase = resolvedBase.replace(/\.([cm]?js)$/u, "");
      resolvedBase = `${resolvedBase}${targetExt}`;
    } else if (targetExt !== ".d.ts" && !currentExt.endsWith("js")) {
      resolvedBase = `${resolvedBase}${targetExt}`;
    }

    const relativePath = path.relative(path.dirname(sourceFile), resolvedBase).replace(/\\/g, "/");
    if (relativePath.startsWith(".")) {
      return relativePath;
    }

    return `./${relativePath}`;
  }

  return null;
}

function normalizeRelativeSpecifier(specifier, sourceFile) {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const hasExtension = /\.[^./\\]+$/u.test(specifier);
  if (hasExtension) {
    return specifier;
  }

  const sourceDir = path.dirname(sourceFile);
  for (const ext of RUNTIME_EXTENSIONS) {
    const candidatePath = path.resolve(sourceDir, `${specifier}${ext}`);
    if (existsSync(candidatePath)) {
      return `${specifier}${ext}`.replace(/\\/g, "/");
    }
  }

  for (const ext of RUNTIME_EXTENSIONS) {
    const indexCandidate = path.resolve(sourceDir, specifier, `index${ext}`);
    if (existsSync(indexCandidate)) {
      return `${specifier.replace(/\\/g, "/")}/index${ext}`;
    }
  }

  return specifier;
}

function transformSpecifiers(content, filePath, targetExt) {
  const patterns = [
    /(from\s+["'])([^"']+)(["'])/g,
    /(import\s*\(\s*["'])([^"']+)(["']\s*\))/g,
    /((?:require|import)\s*\(\s*["'])([^"']+)(["']\s*\))/g,
    /(^\s*import\s+["'])([^"']+)(["'];)/gm
  ];

  let updated = content;

  for (const pattern of patterns) {
    updated = updated.replace(pattern, (full, prefix, specifier, suffix) => {
      let replacement = resolveAlias(specifier, filePath, targetExt);
      if (!replacement) {
        const normalized = normalizeRelativeSpecifier(specifier, filePath);
        if (normalized !== specifier) {
          replacement = normalized;
        }
      }

      if (!replacement) {
        if (specifier.startsWith("@")) {
          return full;
        }
        return full;
      }

      return `${prefix}${replacement}${suffix}`;
    });
  }

  return updated;
}

async function processFile(filePath) {
  try {
    const original = await fs.readFile(filePath, "utf8");
    const targetExt = path.extname(filePath).startsWith(".d") ? ".d.ts" : ".js";
    const transformed = transformSpecifiers(original, filePath, targetExt);

    if (transformed !== original) {
      await fs.writeFile(filePath, transformed, "utf8");
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    console.error(`Failed to rewrite aliases in ${filePath}`, error);
  }
}

async function processAll() {
  try {
    const files = await walk(MAIN_OUT_DIR);
    await Promise.all(files.map((file) => processFile(file)));
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function main() {
  const watch = process.argv.includes("--watch");
  await processAll();

  if (!watch) {
    return;
  }

  const watcher = chokidar.watch(MAIN_OUT_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 20
    }
  });

  watcher.on("add", (filePath) => {
    void processFile(filePath);
  });
  watcher.on("change", (filePath) => {
    void processFile(filePath);
  });
}

main().catch((error) => {
  console.error("Failed to fix dist aliases", error);
  process.exit(1);
});
