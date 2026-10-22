import path from 'path';
import fs from 'fs';
import { Liquid } from 'liquidjs';
import * as yamlModule from 'js-yaml';
const yaml: any = (yamlModule as any).default || yamlModule;
import { marked } from 'marked';

export const PROJECT_ROOT = path.resolve(process.cwd());
export const JEKYLL_ROOT = process.env.JEKYLL_DIR
  ? path.resolve(PROJECT_ROOT, process.env.JEKYLL_DIR)
  : path.join(PROJECT_ROOT, 'site');

// Configure Liquid engine for Jekyll emulation
const engine = new Liquid({
  root: [
    JEKYLL_ROOT,
    path.join(JEKYLL_ROOT, '_includes'),
    path.join(JEKYLL_ROOT, '_layouts')
  ],
  partials: path.join(JEKYLL_ROOT, '_includes'),
  layouts: path.join(JEKYLL_ROOT, '_layouts'),
  extname: '.html',
  cache: false,
  strictVariables: false,
  strictFilters: false,
  dynamicPartials: false,
  jekyllInclude: true
});

// Custom Jekyll Filters
engine.registerFilter('relative_url', (input: any) => {
  if (!input) return '';
  const str = String(input);
  return str.startsWith('/') ? str : `/${str}`;
});

engine.registerFilter('absolute_url', (input: any) => {
  if (!input) return '';
  const str = String(input);
  return str.startsWith('/') ? str : `/${str}`;
});

engine.registerFilter('jsonify', (input: any) => {
  try {
    return JSON.stringify(input);
  } catch {
    return '{}';
  }
});

engine.registerFilter('slugify', (input: any) => {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
});

engine.registerFilter('markdownify', (input: any) => {
  if (!input) return '';
  try {
    return marked.parse(String(input));
  } catch {
    return String(input);
  }
});

engine.registerFilter('where', (arr: any[], key: string, val: any) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => {
    if (!item) return false;
    if (item[key] === val) return true;
    if (Array.isArray(item[key]) && item[key].includes(val)) return true;
    return false;
  });
});

engine.registerFilter('where_exp', (arr: any[]) => {
  return Array.isArray(arr) ? arr : [];
});

engine.registerFilter('find', (arr: any[], key: string, val: any) => {
  if (!Array.isArray(arr)) return null;
  return arr.find(item => item && item[key] === val) || null;
});

engine.registerFilter('date_to_xmlschema', (input: any) => {
  try {
    return new Date(input || Date.now()).toISOString();
  } catch {
    return new Date().toISOString();
  }
});

engine.registerFilter('date_to_long_string', (input: any) => {
  try {
    return new Date(input).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(input || '');
  }
});

engine.registerFilter('date_to_string', (input: any) => {
  try {
    return new Date(input).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(input || '');
  }
});

engine.registerFilter('xml_escape', (input: any) => {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
});

// Frontmatter Splitter Helper
function parseFrontmatter(fileContent: string): { data: Record<string, any>; content: string } {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: fileContent };
  }
  try {
    const data = (yaml.load(match[1]) as Record<string, any>) || {};
    return { data, content: match[2] };
  } catch (err) {
    console.error('Frontmatter parse error:', err);
    return { data: {}, content: match[2] };
  }
}

// Load Global Site Data
export function loadSiteContext(): Record<string, any> {
  const site: Record<string, any> = {
    title: 'Science of Gifts',
    tagline: 'Research-backed, laboratory-tested gift curation for discerning minds.',
    description: 'Curated gift recommendations, scholarly buying guides, and material culture essays tested for durability, craft, and narrative depth.',
    url: 'https://scienceofgifts.com',
    data: {},
    guides: [],
    articles: [],
    time: new Date()
  };

  // 1. Read _config.yml
  const configPath = path.join(JEKYLL_ROOT, '_config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const configDoc = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, any>;
      Object.assign(site, configDoc);
    } catch (e) {
      console.error('Error loading _config.yml:', e);
    }
  }

  // 2. Read _data/*.yml
  const dataDir = path.join(JEKYLL_ROOT, '_data');
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const key = path.basename(file, path.extname(file));
        try {
          const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
          site.data[key] = yaml.load(content);
        } catch (err) {
          console.error(`Error reading _data/${file}:`, err);
        }
      }
    }
  }

  // 3. Read _guides/*.md
  const guidesDir = path.join(JEKYLL_ROOT, '_guides');
  if (fs.existsSync(guidesDir)) {
    const files = fs.readdirSync(guidesDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const slug = path.basename(file, '.md');
        try {
          const raw = fs.readFileSync(path.join(guidesDir, file), 'utf8');
          const parsed = parseFrontmatter(raw);
          site.guides.push({
            slug,
            url: `/${slug}/`,
            ...parsed.data,
            content: parsed.content
          });
        } catch (e) {
          console.error(`Error loading guide ${file}:`, e);
        }
      }
    }
  }

  // 4. Read _articles/*.md
  const articlesDir = path.join(JEKYLL_ROOT, '_articles');
  if (fs.existsSync(articlesDir)) {
    const files = fs.readdirSync(articlesDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const slug = path.basename(file, '.md');
        try {
          const raw = fs.readFileSync(path.join(articlesDir, file), 'utf8');
          const parsed = parseFrontmatter(raw);
          site.articles.push({
            slug,
            url: `/${slug}/`,
            ...parsed.data,
            content: parsed.content
          });
        } catch (e) {
          console.error(`Error loading article ${file}:`, e);
        }
      }
    }
  }

  return site;
}

// Render a layout chain recursively
async function renderWithLayout(layoutName: string, innerContent: string, context: Record<string, any>): Promise<string> {
  const layoutPath = path.join(JEKYLL_ROOT, '_layouts', `${layoutName}.html`);
  if (!fs.existsSync(layoutPath)) {
    return innerContent;
  }

  const rawLayout = fs.readFileSync(layoutPath, 'utf8');
  const { data: layoutData, content: layoutTemplate } = parseFrontmatter(rawLayout);

  const localContext = {
    ...context,
    content: innerContent
  };

  const rendered = await engine.parseAndRender(layoutTemplate, localContext);

  if (layoutData.layout && layoutData.layout !== layoutName) {
    return renderWithLayout(layoutData.layout, rendered, context);
  }

  return rendered;
}

// Master Request Handler
export async function renderJekyllPage(requestPath: string): Promise<{ html: string; status: number }> {
  let cleanPath = requestPath.split('?')[0].replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  const site = loadSiteContext();

  let targetFilePath: string | null = null;
  let pageData: Record<string, any> = {};
  let bodyContent = '';
  let isMarkdown = false;

  // 1. Root / Home
  if (!cleanPath || cleanPath === 'index.html') {
    if (fs.existsSync(path.join(JEKYLL_ROOT, 'index.md'))) {
      targetFilePath = path.join(JEKYLL_ROOT, 'index.md');
      isMarkdown = true;
    } else if (fs.existsSync(path.join(JEKYLL_ROOT, 'index.html'))) {
      targetFilePath = path.join(JEKYLL_ROOT, 'index.html');
    }
  }

  // 2. Guide match (_guides/[slug].md)
  if (!targetFilePath && fs.existsSync(path.join(JEKYLL_ROOT, '_guides', `${cleanPath}.md`))) {
    targetFilePath = path.join(JEKYLL_ROOT, '_guides', `${cleanPath}.md`);
    isMarkdown = true;
  }

  // 3. Article match (_articles/[slug].md)
  if (!targetFilePath && fs.existsSync(path.join(JEKYLL_ROOT, '_articles', `${cleanPath}.md`))) {
    targetFilePath = path.join(JEKYLL_ROOT, '_articles', `${cleanPath}.md`);
    isMarkdown = true;
  }

  // 4. Directory with index.html or index.md (e.g. /gift-finder/index.html, /about/index.html)
  if (!targetFilePath) {
    const dirIndexHtml = path.join(JEKYLL_ROOT, cleanPath, 'index.html');
    const dirIndexMd = path.join(JEKYLL_ROOT, cleanPath, 'index.md');
    const directHtml = path.join(JEKYLL_ROOT, `${cleanPath}.html`);
    const directMd = path.join(JEKYLL_ROOT, `${cleanPath}.md`);

    if (fs.existsSync(dirIndexHtml)) {
      targetFilePath = dirIndexHtml;
    } else if (fs.existsSync(dirIndexMd)) {
      targetFilePath = dirIndexMd;
      isMarkdown = true;
    } else if (fs.existsSync(directHtml)) {
      targetFilePath = directHtml;
    } else if (fs.existsSync(directMd)) {
      targetFilePath = directMd;
      isMarkdown = true;
    }
  }

  // 5. Fallback: 404 page
  if (!targetFilePath || !fs.existsSync(targetFilePath)) {
    const notFoundPath = path.join(JEKYLL_ROOT, '404.html');
    if (fs.existsSync(notFoundPath)) {
      targetFilePath = notFoundPath;
    } else {
      return {
        status: 404,
        html: `
          <!DOCTYPE html>
          <html>
          <head><title>404 Page Not Found | Science of Gifts</title></head>
          <body style="font-family:sans-serif; text-align:center; padding:40px;">
            <h1>404 - Page Not Found</h1>
            <p>Could not locate the requested page: <code>/${cleanPath}</code></p>
            <a href="/preview/">Return to Homepage</a>
          </body>
          </html>
        `
      };
    }
  }

  // Parse target file
  const rawContent = fs.readFileSync(targetFilePath, 'utf8');
  const parsed = parseFrontmatter(rawContent);
  pageData = {
    ...parsed.data,
    url: `/${cleanPath ? `${cleanPath}/` : ''}`
  };

  // Resolve default layouts from Jekyll collections config
  if (!pageData.layout) {
    if (targetFilePath.includes('_guides') || targetFilePath.includes('/_guides/')) {
      pageData.layout = 'guide';
    } else if (targetFilePath.includes('_articles') || targetFilePath.includes('/_articles/')) {
      pageData.layout = 'article';
    } else if (cleanPath === '' || cleanPath === 'index.html' || cleanPath === 'index.md') {
      pageData.layout = 'home';
    } else {
      pageData.layout = 'default';
    }
  }

  // If author string is specified, expand author object
  if (pageData.author && typeof pageData.author === 'string' && site.data.authors && site.data.authors[pageData.author]) {
    pageData.author = site.data.authors[pageData.author];
  }

  // Step A: Render liquid tags inside the page template body first
  const pageRenderContext = {
    site,
    page: pageData
  };

  const initialRendered = await engine.parseAndRender(parsed.content, pageRenderContext);

  // Step B: Convert markdown if applicable
  bodyContent = isMarkdown ? (await marked.parse(initialRendered)) : initialRendered;

  // Step C: Wrap with layout hierarchy
  let finalHtml = bodyContent;
  if (pageData.layout) {
    finalHtml = await renderWithLayout(pageData.layout, bodyContent, {
      site,
      page: pageData
    });
  }

  return {
    status: 200,
    html: finalHtml
  };
}
