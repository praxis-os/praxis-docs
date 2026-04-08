import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import {globSync} from 'glob';

interface RagChunk {
  id: string;
  page_title: string;
  section_title: string;
  url: string;
  content: string;
  content_type: 'prose' | 'code_example' | 'table' | 'diagram';
  metadata: {
    rag_section: string;
    rag_packages: string[];
    rag_interfaces: string[];
    rag_difficulty: string;
    keywords: string[];
    has_code: boolean;
    has_diagram: boolean;
    word_count: number;
  };
}

interface RagIndex {
  version: string;
  generated: string;
  site_url: string;
  chunks: RagChunk[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectContentType(content: string): 'prose' | 'code_example' | 'table' | 'diagram' {
  if (content.includes('```mermaid')) return 'diagram';
  const codeBlockCount = (content.match(/```/g) || []).length / 2;
  const lines = content.split('\n');
  const tableLines = lines.filter(l => l.includes('|') && l.trim().startsWith('|')).length;
  if (tableLines > 3) return 'table';
  if (codeBlockCount >= 2) return 'code_example';
  return 'prose';
}

function splitByH2(markdownBody: string): Array<{title: string; content: string}> {
  const sections: Array<{title: string; content: string}> = [];
  const lines = markdownBody.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || 'Introduction',
          content: currentContent.join('\n').trim(),
        });
      }
      currentTitle = h2Match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || 'Introduction',
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
}

function main() {
  const docsDir = path.resolve(__dirname, '..', 'docs');
  const buildDir = path.resolve(__dirname, '..', 'build');
  const files = globSync('**/*.md', {cwd: docsDir});

  const chunks: RagChunk[] = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const {data: frontmatter, content: body} = matter(raw);

    const pageTitle = (frontmatter.title as string) || path.basename(file, '.md');
    const ragSection = (frontmatter.rag_section as string) || 'unknown';
    const ragPackages = (frontmatter.rag_packages as string[]) || [];
    const ragInterfaces = (frontmatter.rag_interfaces as string[]) || [];
    const ragDifficulty = (frontmatter.rag_difficulty as string) || 'intermediate';
    const keywords = (frontmatter.keywords as string[]) || [];

    const docPath = file.replace(/\.md$/, '');
    const sections = splitByH2(body);

    for (const section of sections) {
      if (!section.content.trim()) continue;

      const sectionSlug = slugify(section.title);
      const chunkId = section.title === 'Introduction'
        ? docPath
        : `${docPath}#${sectionSlug}`;

      const url = section.title === 'Introduction'
        ? `/docs/${docPath}`
        : `/docs/${docPath}#${sectionSlug}`;

      const hasCode = section.content.includes('```');
      const hasDiagram = section.content.includes('```mermaid');
      const wordCount = section.content
        .replace(/```[\s\S]*?```/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0).length;

      chunks.push({
        id: chunkId,
        page_title: pageTitle,
        section_title: section.title,
        url,
        content: section.content,
        content_type: detectContentType(section.content),
        metadata: {
          rag_section: ragSection,
          rag_packages: ragPackages,
          rag_interfaces: ragInterfaces,
          rag_difficulty: ragDifficulty,
          keywords,
          has_code: hasCode,
          has_diagram: hasDiagram,
          word_count: wordCount,
        },
      });
    }
  }

  const index: RagIndex = {
    version: '1.0',
    generated: new Date().toISOString(),
    site_url: 'https://praxis-os.github.io/praxis-docs',
    chunks,
  };

  fs.mkdirSync(buildDir, {recursive: true});
  fs.writeFileSync(
    path.join(buildDir, 'rag-index.json'),
    JSON.stringify(index, null, 2),
  );

  // Meta stats
  const sectionCounts: Record<string, number> = {};
  for (const chunk of chunks) {
    const sec = chunk.metadata.rag_section;
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
  }

  const meta = {
    total_chunks: chunks.length,
    total_pages: files.length,
    sections: sectionCounts,
    generated: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(buildDir, 'rag-index-meta.json'),
    JSON.stringify(meta, null, 2),
  );

  console.log(`RAG index exported: ${chunks.length} chunks from ${files.length} pages`);
  console.log('Sections:', JSON.stringify(sectionCounts, null, 2));
}

main();
