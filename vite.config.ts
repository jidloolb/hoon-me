import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "crypto";

// 오프라인 동작용 service worker 를 빌드 때 생성한다.
// 번들 파일 이름(해시 포함)을 전부 미리 캐시 → 한 번 열면 인터넷 없이 실행.
function serviceWorker(): Plugin {
  return {
    name: "offline-sw",
    apply: "build",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      const assets = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", ...files.map((f) => `./${f}`)];
      const version = createHash("sha1").update(files.join("|")).digest("hex").slice(0, 10);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE = "me-${version}";
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 우선: 앱 파일은 폰에 있는 걸 쓴다. 새 버전은 다음 실행 때 반영.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
`,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), serviceWorker()],
});
