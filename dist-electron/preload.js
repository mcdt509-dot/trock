import { contextBridge as e } from "electron";
e.exposeInMainWorld("electron", {
  // Add any IPC methods if needed later
});
