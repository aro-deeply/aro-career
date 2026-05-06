import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        diagnosis: resolve(__dirname, "diagnosis.html"),
        blogIndex: resolve(__dirname, "blog/index.html"),
        blogPostResumeFeedback: resolve(
          __dirname,
          "blog/why-resume-feedback-fails.html"
        ),
      },
    },
  },
});
