import { z } from "zod";

const logRotationSchema = z
  .object({
    maxFileSizeMB: z.number().int().positive().default(10),
    maxFiles: z.number().int().positive().default(5),
    retentionDays: z.number().int().positive().default(30)
  })
  .default({ maxFileSizeMB: 10, maxFiles: 5, retentionDays: 30 });

export const settingsSchema = z.object({
  input: z
    .object({
      maxWarnSizeMB: z.number().int().positive().default(10),
      maxAbortSizeMB: z.number().int().positive().default(200)
    })
    .default({ maxWarnSizeMB: 10, maxAbortSizeMB: 200 }),
  file: z
    .object({
      encodingFallback: z.enum(["reject", "assume-sjis", "assume-utf8"]).default("reject"),
      normalizeNewline: z.boolean().default(true)
    })
    .default({ encodingFallback: "reject", normalizeNewline: true }),
  converter: z
    .object({
      strategy: z.enum(["rule", "llm"]).default("rule"),
      timeoutMs: z.union([z.literal("none"), z.number().int().positive()]).default(60000)
    })
    .default({ strategy: "rule", timeoutMs: 60000 }),
  llm: z
    .object({
    provider: z.enum(["openai", "gemini", "ollama", "none"]).default("none"),
    endpoint: z.string().optional().default(""),
    model: z.string().optional().default(""),
    temperature: z.number().min(0).max(2).default(0),
    maxTokens: z.number().int().positive().optional(),
    allowCloud: z.boolean().default(false),
    redaction: z.object({
      enabled: z.boolean().default(false)
    }).default({ enabled: false }),
    apiKey: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    maxConcurrency: z.number().int().positive().optional()
  })
    .default({
      provider: "none",
      endpoint: "",
      model: "",
      temperature: 0,
      allowCloud: false,
      redaction: { enabled: false }
    }),
  log: z
    .object({
      logLevel: z.enum(["info", "warn", "error", "debug"]).default("info"),
      logRotation: logRotationSchema
    })
    .default({ logLevel: "info", logRotation: { maxFileSizeMB: 10, maxFiles: 5, retentionDays: 30 } }),
  history: z
    .object({
      maxDepth: z.number().int().positive().default(1000),
      perFile: z.boolean().default(true),
      persistOnExit: z.boolean().default(false)
    })
    .default({ maxDepth: 1000, perFile: true, persistOnExit: false }),
  ui: z
    .object({
      autoSave: z
        .object({
          enabled: z.boolean().default(false),
          intervalMs: z.number().int().positive().default(300000)
        })
        .default({ enabled: false, intervalMs: 300000 }),
      theme: z.enum(["light", "dark", "system"]).default("system"),
      locale: z.string().default("ja-JP"),
      font: z
        .object({
          family: z.string().default("'Inter', system-ui"),
          size: z.number().int().positive().default(14)
        })
        .default({ family: "'Inter', system-ui", size: 14 }),
      window: z
        .object({
          startMaximized: z.boolean().default(false),
          bounds: z
            .object({ x: z.number().optional(), y: z.number().optional(), width: z.number(), height: z.number() })
            .optional()
        })
        .default({ startMaximized: false }),
      tab: z
        .object({
          maxWidth: z.number().int().positive().default(240),
          height: z.number().int().positive().default(36)
        })
        .default({ maxWidth: 240, height: 36 }),
      highlightColors: z
        .object({
          selected: z.string().default("#2563EB"),
          edited: z.string().default("#F59E0B"),
          traceHighlight: z.string().default("#10B981")
        })
        .default({ selected: "#2563EB", edited: "#F59E0B", traceHighlight: "#10B981" })
    })
    .default({
      autoSave: { enabled: false, intervalMs: 300000 },
      theme: "system",
      locale: "ja-JP",
      font: { family: "'Inter', system-ui", size: 14 },
      window: { startMaximized: false },
      tab: { maxWidth: 240, height: 36 },
      highlightColors: { selected: "#2563EB", edited: "#F59E0B", traceHighlight: "#10B981" }
    }),
  trace: z
    .object({
      defaultDirection: z.enum(["bidirectional", "left_to_right", "right_to_left"]).default("bidirectional"),
      highlightColors: z
        .object({
          selected: z.string().default("#8B5CF6"),
          traceHighlight: z.string().default("#6366F1")
        })
        .default({ selected: "#8B5CF6", traceHighlight: "#6366F1" })
    })
    .default({
      defaultDirection: "bidirectional",
      highlightColors: { selected: "#8B5CF6", traceHighlight: "#6366F1" }
    }),
  fileWatcher: z
    .object({
      enabled: z.boolean().default(true),
      debounceMs: z.number().int().positive().default(500),
      autoReloadPolicy: z.enum(["prompt", "auto", "ignore"]).default("prompt"),
      ignorePatterns: z.array(z.string()).default(["**/node_modules/**", "**/.git/**"])
    })
    .default({
      enabled: true,
      debounceMs: 500,
      autoReloadPolicy: "prompt",
      ignorePatterns: ["**/node_modules/**", "**/.git/**"]
    }),
  search: z
    .object({
      defaultRegex: z.boolean().default(false),
      maxResults: z.number().int().positive().default(200),
      caseSensitiveDefault: z.boolean().default(false)
    })
    .default({ defaultRegex: false, maxResults: 200, caseSensitiveDefault: false }),
  concurrency: z
    .object({
      fileLocking: z.enum(["optimistic", "pessimistic", "none"]).default("optimistic"),
      maxOpenFiles: z.number().int().positive().default(32)
    })
    .default({ fileLocking: "optimistic", maxOpenFiles: 32 }),
  recentFiles: z
    .object({
      limit: z.number().int().positive().default(10)
    })
    .default({ limit: 10 }),
  uiShortcuts: z.record(z.string()).default({})
});

export type AppSettings = z.infer<typeof settingsSchema>;

export function parseSettings(raw: unknown): AppSettings {
  return settingsSchema.parse(raw);
}

export const defaultSettings: AppSettings = settingsSchema.parse({});
