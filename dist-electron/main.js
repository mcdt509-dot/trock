import { app as o, BrowserWindow as t, shell as a } from "electron";
import n from "path";
import { fileURLToPath as l } from "url";
const s = n.dirname(l(import.meta.url));
function r() {
  const e = new t({
    width: 1200,
    height: 800,
    title: "TROCK Neural Interface",
    backgroundColor: "#050505",
    show: !1,
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      preload: n.join(s, "preload.mjs")
    }
  });
  process.env.VITE_DEV_SERVER_URL ? e.loadURL(process.env.VITE_DEV_SERVER_URL) : e.loadFile(n.join(process.env.DIST, "index.html")), e.once("ready-to-show", () => {
    e.show();
  }), e.webContents.setWindowOpenHandler(({ url: i }) => (a.openExternal(i), { action: "deny" }));
}
o.whenReady().then(r);
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
o.on("activate", () => {
  t.getAllWindows().length === 0 && r();
});
