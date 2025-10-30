<div align="center">

  <img src="./src/assets/logo.svg" alt="Sankhya React Vite Boilerplate" height="120" />

  <h1>Boilerplate — Sankhya HTML5 Component (React + Vite)</h1>

  <p>
    A minimal, batteries‑included starter to build and ship Sankhya ERP HTML5 components
    using React 19 and Vite 7 — with JSP scaffold, stable asset filenames, alias support,
    Tailwind (optional), and a ZIP bundle ready for import in Sankhya.
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://badges.aleen42.com/src/vitejs.svg" alt="Vite" />
  </p>
  <p>
    <a href="#getting-started"><img src="https://img.shields.io/badge/Getting%20Started-quick-blue" alt="Getting Started" /></a>
    <a href="https://github.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" /></a>
    <a href="#license"><img src="https://img.shields.io/badge/License-MIT-black" alt="License: MIT" /></a>
  </p>
</div>

---

## Highlights

- React 19 + Vite 7 with TypeScript
- Stable asset names for Sankhya (e.g. `assets/app.js`, `assets/index.css`)
- Alias `@` → `src` for clean imports (Vite + TS configured)
- JSP scaffold that loads the built app inside Sankhya as HTML5 component
- Relative assets (`base: "./"`) to support `${BASE_FOLDER}` paths
- Optional Tailwind via `@tailwindcss/vite`
- Auto ZIP after build (`dist/sankhya-component.zip`) using `vite-plugin-zip-pack`

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Main entry points:

- `src/main.tsx` — mounts the app
- `src/app/app.tsx` — demo UI
- `index.html` — html demo view

## Build for Sankhya

```bash
pnpm build
```

This produces:

- `dist/index.jsp` — page to be served by Sankhya
- `dist/assets/app.js` — bundled JS (ESM)
- `dist/assets/index.css` — styles
- `dist/assets/*.svg` — logos and images (not inlined)
- `dist/sankhya-component.zip` — ready to import in Sankhya

Copy the entire `dist/` (or only the ZIP) to your HTML5 component folder in Sankhya.

## Project Structure

```
src/
  app/app.tsx        # Demo component
  assets/*           # Logos and images
  global.css         # Global styles (Tailwind ready)
  main.tsx           # App entry
public/
  index.jsp          # JSP scaffold used in Sankhya
vite.config.ts       # Build config (stable outputs, base "./", zip pack)
```

## NPM Scripts

- `pnpm dev` — start Vite dev server
- `pnpm build` — typecheck + production build + ZIP
- `pnpm preview` — preview production build

## Sankhya Notes

- Assets use relative URLs (`base: "./"`) so `${BASE_FOLDER}` works in JSP.
- Small images are not inlined (`assetsInlineLimit: 0`) so they exist as physical files in `dist/assets`.
- If your Sankhya environment doesn’t support `<script type="module">`, add `@vitejs/plugin-legacy` and load the legacy bundle in `index.jsp`.

## FAQ

**Logos aren’t loading inside Sankhya**

- Ensure you’re using the built files from `dist/` (not the dev server URLs).
- Check that your component path resolves `${BASE_FOLDER}/assets/*` correctly.

**How do I change the output names?**

- See `vite.config.ts → build.rollupOptions.output`.

## Contributing

PRs are welcome! Please lint and keep changes focused.

## License

MIT © 2025
