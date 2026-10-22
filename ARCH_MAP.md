# Science of Gifts — Architectural Map & Directory Structure

This document provides a comprehensive overview of the **Science of Gifts** application architecture, clearly mapping the clean separation between the **Jekyll Public Static Site** (`site/`) and the **React CMS Dashboard** (`src/`, `server.ts`).

---

## Architecture Overview

The application is built with complete separation of concerns:
1. **The Public Jekyll Website (`site/`)**: A 100% self-contained, replaceable static site containing its own `_config.yml`, `Gemfile`, `_layouts/`, `_includes/`, `_data/`, `_guides/`, `_articles/`, pages, and `assets/`. Can be run independently via standard Jekyll tools (`cd site && bundle exec jekyll serve`).
2. **The Local CMS Dashboard (`src/`, `server.ts`, `server-liquid-renderer.ts`)**: A React + TypeScript single-page application and Express backend with local Liquid rendering. Connects to `site/` via `JEKYLL_ROOT` to manage products, guides, articles, collections, navigation, assets, and SEO, keeping automated snapshot backups safely in `editor-backups/` outside `site/`.

---

## Directory Map

### 1. Jekyll Public Website (`site/`)
All Jekyll files are entirely housed inside `site/` and can be edited or replaced without affecting CMS code:

| Directory / File | Description |
| :--- | :--- |
| **`site/_config.yml`** | Jekyll site configuration and collection settings. |
| **`site/Gemfile`** | Ruby Gemfile for standard Jekyll execution. |
| **`site/_layouts/`** | Master HTML layouts (`default.html`, `guide.html`, `article.html`, `page.html`). |
| **`site/_includes/`** | Reusable Liquid partials (`product-card-grid.html`, `product-card.html`, `editorial-image.html`, `newsletter.html`, `footer.html`, `header.html`, etc.). |
| **`site/_data/`** | YAML database files (`products.yml`, `collections.yml`, `settings.yml`, `interests.yml`, `navigation.yml`, `authors.yml`, `gift_finder.yml`). |
| **`site/_guides/`** | Markdown files for scholarly gift guides. |
| **`site/_articles/`** | Markdown files for editorial essays. |
| **`site/assets/`** | Public assets (`assets/images/`, `assets/css/`, `assets/js/main.js`). |
| **`site/` Root Pages** | HTML/Markdown entry pages (`index.html`, `index.md`, `404.html`, `about/`, `gift-finder/`, `gift-guides/`, `articles/`, `collections/`, `contact/`, `privacy/`, `terms/`, `robots.txt`, `sitemap.xml`). |

---

### 2. Local CMS Dashboard (`src/`)
These files power the React editing dashboard and local content management interface.

| Directory / File | Description |
| :--- | :--- |
| **`src/App.tsx`** | Main entry point for the CMS dashboard navigation and state management. |
| **`src/types/`** | TypeScript type definitions (`product.ts`, `guide.ts`, `articles.ts`, `assets.ts`, `collections.ts`, `giftFinder.ts`). |
| **`src/components/products/`** | Product catalog management (`ProductManager.tsx`, `ProductForm.tsx`, `ProductCardPreview.tsx`). |
| **`src/components/guides/`** | Gift guide management and WYSIWYG editor (`GuideManager.tsx`, `GuideEditor.tsx`, `GuidePreview.tsx`, `ProductPickerModal.tsx`). |
| **`src/components/articles/`** | Editorial article editor (`ArticleEditor.tsx`, `ArticlePreview.tsx`). |
| **`src/components/collections/`** | Collection category editor (`CollectionEditor.tsx`, `CollectionPreview.tsx`). |
| **`src/components/gift-finder/`** | Gift Finder 6-step questionnaire and FAQ editor (`GiftFinderEditor.tsx`, `GiftFinderPreview.tsx`). |
| **`src/components/assets/`** | Media library management & asset picker modal (`AssetManager.tsx`, `AssetPickerModal.tsx`, `AssetDetailModal.tsx`). |
| **`src/components/editor/`** | Rich text editor (TipTap markdown integration). |
| **`src/components/homepage/`** | Homepage frontmatter and hero curation editor. |
| **`src/components/diagnostics/`** | System diagnostics dashboard (orphaned asset detection, schema validation). |
| **`src/components/settings/`** | Global site configuration and backup management. |

---

### 3. Backend, Server & Backups (`server.ts`, `server-liquid-renderer.ts`, `editor-backups/`)

| File / Directory | Description |
| :--- | :--- |
| **`server.ts`** | Express backend exposing REST API endpoints for all CMS modules. Reads/writes to `JEKYLL_ROOT` (`./site`). |
| **`server-liquid-renderer.ts`** | Liquid.js rendering engine that emulates Jekyll templates locally from `JEKYLL_ROOT` for real-time live preview. |
| **`editor-backups/`** | Dedicated snapshot backup storage (kept safely outside `site/`). |
| **`vite.config.ts`** | Vite configuration for bundling the React CMS client app. |
