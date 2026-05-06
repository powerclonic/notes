/**
 * SlideFramework DSL — parser and types.
 *
 * The DSL is a plain-text, line-based format where every directive starts with
 * "@@".  Each presentation is a sequence of @@SLIDE … @@END blocks.
 *
 * Example:
 *
 *   @@SLIDE layout=title
 *   @@TITLE My Presentation
 *   @@SUBTITLE Q2 Review · 2025
 *   @@NOTES Say hello and introduce yourself.
 *   @@END
 *
 *   @@SLIDE layout=bullets
 *   @@HEADING Agenda
 *   @@BULLET Item 1
 *   @@BULLET Item 2
 *   @@SUBBULLET Sub-detail of item 2
 *   @@NOTES Keep this slide brief.
 *   @@END
 */

export type SlideLayout =
  | 'title'
  | 'section'
  | 'bullets'
  | 'image-text'
  | 'image-bullets'
  | 'two-col'
  | 'quote'
  | 'closing';

export interface BulletItem {
  text: string;
  /** 1 = top-level bullet, 2 = sub-bullet */
  level: 1 | 2;
}

export interface SlideColumn {
  heading?: string;
  text?: string;
  bullets: BulletItem[];
}

export interface SlideContent {
  title?: string;
  subtitle?: string;
  heading?: string;
  text?: string;
  bullets: BulletItem[];
  /** Image description used to render a graphic placeholder */
  image?: string;
  quote?: string;
  author?: string;
  notes?: string;
  col1?: SlideColumn;
  col2?: SlideColumn;
}

export interface Slide {
  layout: SlideLayout;
  content: SlideContent;
}

export interface Presentation {
  title: string;
  slides: Slide[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_LAYOUTS = new Set<string>([
  'title',
  'section',
  'bullets',
  'image-text',
  'image-bullets',
  'two-col',
  'quote',
  'closing',
]);

function emptyContent(): SlideContent {
  return { bullets: [] };
}

function emptyColumn(): SlideColumn {
  return { bullets: [] };
}

/** If `line` starts with `prefix` return the remainder, otherwise null. */
function arg(line: string, prefix: string): string | null {
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseSlideDsl(raw: string): Presentation {
  const lines = raw.split('\n');
  const slides: Slide[] = [];
  let current: Slide | null = null;
  let inCol1 = false;
  let inCol2 = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // --- Slide start ---
    if (line.startsWith('@@SLIDE')) {
      const m = line.match(/layout=(\S+)/);
      const layout =
        m && VALID_LAYOUTS.has(m[1]) ? (m[1] as SlideLayout) : 'bullets';
      current = { layout, content: emptyContent() };
      inCol1 = false;
      inCol2 = false;
      continue;
    }

    // --- Slide end ---
    if (line === '@@END') {
      if (current) slides.push(current);
      current = null;
      inCol1 = false;
      inCol2 = false;
      continue;
    }

    if (!current) continue;

    // --- Column delimiters ---
    if (line === '@@COL1') {
      inCol1 = true;
      inCol2 = false;
      if (!current.content.col1) current.content.col1 = emptyColumn();
      continue;
    }
    if (line === '@@COL1END') {
      inCol1 = false;
      continue;
    }
    if (line === '@@COL2') {
      inCol2 = true;
      inCol1 = false;
      if (!current.content.col2) current.content.col2 = emptyColumn();
      continue;
    }
    if (line === '@@COL2END') {
      inCol2 = false;
      continue;
    }

    // --- Directives ---

    const title = arg(line, '@@TITLE ');
    if (title !== null) {
      current.content.title = title;
      continue;
    }

    const subtitle = arg(line, '@@SUBTITLE ');
    if (subtitle !== null) {
      current.content.subtitle = subtitle;
      continue;
    }

    // @@COLHEADING is an alias for @@HEADING inside a column block
    const colheading = arg(line, '@@COLHEADING ');
    if (colheading !== null) {
      if (inCol1 && current.content.col1)
        current.content.col1.heading = colheading;
      else if (inCol2 && current.content.col2)
        current.content.col2.heading = colheading;
      continue;
    }

    const heading = arg(line, '@@HEADING ');
    if (heading !== null) {
      if (inCol1 && current.content.col1)
        current.content.col1.heading = heading;
      else if (inCol2 && current.content.col2)
        current.content.col2.heading = heading;
      else current.content.heading = heading;
      continue;
    }

    const text = arg(line, '@@TEXT ');
    if (text !== null) {
      const append = (prev?: string) =>
        prev ? prev + '\n' + text : text;
      if (inCol1 && current.content.col1)
        current.content.col1.text = append(current.content.col1.text);
      else if (inCol2 && current.content.col2)
        current.content.col2.text = append(current.content.col2.text);
      else current.content.text = append(current.content.text);
      continue;
    }

    const bullet = arg(line, '@@BULLET ');
    if (bullet !== null) {
      const item: BulletItem = { text: bullet, level: 1 };
      if (inCol1 && current.content.col1)
        current.content.col1.bullets.push(item);
      else if (inCol2 && current.content.col2)
        current.content.col2.bullets.push(item);
      else current.content.bullets.push(item);
      continue;
    }

    const subbullet = arg(line, '@@SUBBULLET ');
    if (subbullet !== null) {
      const item: BulletItem = { text: subbullet, level: 2 };
      if (inCol1 && current.content.col1)
        current.content.col1.bullets.push(item);
      else if (inCol2 && current.content.col2)
        current.content.col2.bullets.push(item);
      else current.content.bullets.push(item);
      continue;
    }

    const image = arg(line, '@@IMAGE ');
    if (image !== null) {
      current.content.image = image;
      continue;
    }

    const quote = arg(line, '@@QUOTE ');
    if (quote !== null) {
      current.content.quote = quote;
      continue;
    }

    const author = arg(line, '@@AUTHOR ');
    if (author !== null) {
      current.content.author = author;
      continue;
    }

    const notes = arg(line, '@@NOTES ');
    if (notes !== null) {
      current.content.notes = notes;
      continue;
    }
  }

  // Derive presentation title from the first title/closing slide, or first heading
  const presentationTitle =
    slides.find((s) => s.layout === 'title')?.content.title ??
    slides.find((s) => s.layout === 'closing')?.content.title ??
    slides[0]?.content.heading ??
    'Apresentação';

  return { title: presentationTitle, slides };
}
