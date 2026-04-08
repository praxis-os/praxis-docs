import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import {globSync} from 'glob';

const REQUIRED_FIELDS = [
  'title',
  'description',
  'keywords',
  'rag_section',
  'rag_packages',
  'rag_interfaces',
  'rag_difficulty',
];

const VALID_SECTIONS = [
  'getting-started',
  'core-concepts',
  'api-reference',
  'guides',
  'examples',
  'design-decisions',
  'contributing',
];

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

interface ValidationError {
  file: string;
  field: string;
  message: string;
}

function main() {
  const docsDir = path.resolve(__dirname, '..', 'docs');
  const files = globSync('**/*.md', {cwd: docsDir});
  const errors: ValidationError[] = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const {data: frontmatter} = matter(raw);

    for (const field of REQUIRED_FIELDS) {
      if (!(field in frontmatter)) {
        errors.push({file, field, message: `Missing required field: ${field}`});
        continue;
      }

      const value = frontmatter[field];

      if (field === 'description' && typeof value === 'string') {
        if (!value.endsWith('.')) {
          errors.push({
            file,
            field,
            message: 'Description must be a complete sentence ending with a period',
          });
        }
      }

      if (field === 'keywords' && !Array.isArray(value)) {
        errors.push({file, field, message: 'Keywords must be an array'});
      }

      if (field === 'rag_section' && !VALID_SECTIONS.includes(value as string)) {
        errors.push({
          file,
          field,
          message: `Invalid rag_section: "${value}". Must be one of: ${VALID_SECTIONS.join(', ')}`,
        });
      }

      if (field === 'rag_packages' && !Array.isArray(value)) {
        errors.push({file, field, message: 'rag_packages must be an array'});
      }

      if (field === 'rag_interfaces' && !Array.isArray(value)) {
        errors.push({file, field, message: 'rag_interfaces must be an array'});
      }

      if (field === 'rag_difficulty' && !VALID_DIFFICULTIES.includes(value as string)) {
        errors.push({
          file,
          field,
          message: `Invalid rag_difficulty: "${value}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
        });
      }
    }
  }

  if (errors.length > 0) {
    console.error(`\nRAG frontmatter validation failed with ${errors.length} error(s):\n`);
    for (const err of errors) {
      console.error(`  ${err.file}: [${err.field}] ${err.message}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(`RAG frontmatter validation passed: ${files.length} files checked`);
}

main();
