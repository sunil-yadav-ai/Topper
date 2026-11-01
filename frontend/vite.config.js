import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, frontendRoot, "VITE_");
  const publisherId =
    process.env.VITE_ADSENSE_CLIENT_ID ?? env.VITE_ADSENSE_CLIENT_ID ?? "";
  const adsEnabled =
    (process.env.VITE_ADSENSE_ENABLED ?? env.VITE_ADSENSE_ENABLED) === "true";
  const consentReady =
    (process.env.VITE_ADSENSE_CONSENT_READY ?? env.VITE_ADSENSE_CONSENT_READY) === "true";
  if (publisherId && !/^ca-pub-\d+$/.test(publisherId)) {
    throw new Error("VITE_ADSENSE_CLIENT_ID must be a valid ca-pub- publisher ID.");
  }

  return {
    plugins: [
      react(),
      {
        name: "generate-ads-txt",
        apply: "build",
        closeBundle() {
          if (!adsEnabled || !consentReady || !publisherId) return;
          const publisherNumber = publisherId.slice("ca-pub-".length);
          writeFileSync(
            resolve(frontendRoot, "dist", "ads.txt"),
            `google.com, pub-${publisherNumber}, DIRECT, f08c47fec0942fa0\n`,
          );
        },
      },
    ],
  };
});
