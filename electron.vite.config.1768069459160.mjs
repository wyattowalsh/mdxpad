// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
var __electron_vite_injected_dirname = "/Users/ww/dev/projects/mdxpad";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      lib: {
        entry: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
      }
    },
    resolve: {
      alias: {
        "@main": resolve(__electron_vite_injected_dirname, "src/main"),
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      lib: {
        entry: resolve(__electron_vite_injected_dirname, "src/preload/index.ts"),
        formats: ["cjs"]
      },
      rollupOptions: {
        output: {
          entryFileNames: "[name].js"
        }
      }
    },
    resolve: {
      alias: {
        "@preload": resolve(__electron_vite_injected_dirname, "src/preload"),
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared")
      }
    }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    base: "./",
    resolve: {
      alias: {
        "@renderer": resolve(__electron_vite_injected_dirname, "src/renderer"),
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared"),
        "@ui": resolve(__electron_vite_injected_dirname, "src/renderer/components/ui")
      }
    },
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: {
          main: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          "preview-frame": resolve(__electron_vite_injected_dirname, "src/renderer/preview-frame/index.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
