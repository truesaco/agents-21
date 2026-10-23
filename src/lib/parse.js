import { segmentText } from "./segment.js";

// Converts an uploaded file into a document with locatable segments:
// PDFs by page, Word files by heading, text/Markdown by heading or line range.

let idCounter = 0;
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export const ACCEPTED = ".pdf,.docx,.txt,.md,.markdown,.csv";

export async function parseFile(file) {
  const name = file.name;
  const ext = name.toLowerCase().split(".").pop();
  let segments;
  if (ext === "pdf") segments = await parsePdf(file);
  else if (ext === "docx") segments = await parseDocx(file);
  else if (["txt", "md", "markdown", "csv"].includes(ext)) segments = segmentText(await file.text());
  else throw new Error(`${name}: unsupported file type. Use PDF, DOCX, TXT or MD.`);
  if (!segments.length || segments.every((s) => !s.text.trim())) {
    throw new Error(`${name}: no readable text found. Scanned PDFs need OCR before upload.`);
  }
  return { id: newId("doc"), name, segments };
}

export function documentFromPaste(name, text) {
  return { id: newId("doc"), name, segments: segmentText(text) };
}

async function parsePdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const segments = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (text) segments.push({ locator: `Page ${p}`, text });
  }
  return segments;
}

async function parseDocx(file) {
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const segments = [];
  let current = null;
  let paragraph = 0;
  for (const el of body.children) {
    const text = el.textContent.trim();
    if (!text) continue;
    if (/^H[1-6]$/.test(el.tagName)) {
      if (current?.lines.length) segments.push(finish(current));
      current = { locator: `Section "${text}"`, lines: [] };
      continue;
    }
    paragraph++;
    if (!current) current = { locator: null, lines: [], firstParagraph: paragraph };
    current.lines.push(el.tagName === "UL" || el.tagName === "OL" ? listText(el) : text);
    current.lastParagraph = paragraph;
  }
  if (current?.lines.length) segments.push(finish(current));
  return segments;
}

function finish(seg) {
  const locator = seg.locator ?? `Paragraphs ${seg.firstParagraph}-${seg.lastParagraph}`;
  return { locator, text: seg.lines.join("\n") };
}

function listText(el) {
  return [...el.querySelectorAll("li")].map((li) => `- ${li.textContent.trim()}`).join("\n");
}
