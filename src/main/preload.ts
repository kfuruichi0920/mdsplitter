import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("mdsplitter", {
  version: "0.1.0"
});
