export type CardStatus = "draft" | "review" | "approved" | "deprecated";

export interface CardContent {
  text: string;
  number?: string | null;
}

export interface CardNode {
  id: string;
  type: "heading" | "paragraph" | "bullet" | "figure" | "table" | "test" | "qa" | "other";
  status: CardStatus;
  content: CardContent;
  updatedAt: string;
  parentId: string | null;
  childIds: string[];
  prevId: string | null;
  nextId: string | null;
}

export interface CardFile {
  schemaVersion: number;
  header: {
    id: string;
    fileName: string;
    orgInputFilePath: string;
    inputFilePath: string;
    createdAt: string;
    updatedAt: string;
    memo?: string;
  };
  body: CardNode[];
}

export type { AppSettings } from "./settings/schema";
export { parseSettings, defaultSettings, settingsSchema } from "./settings/schema";
