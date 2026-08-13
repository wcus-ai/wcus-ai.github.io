import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Source of truth for project metadata. Markdown body (below frontmatter) is
// rendered as the project detail page's prose.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    links: z
      .array(
        z.object({
          type: z.enum(['repo', 'docs', 'demo']),
          label: z.string(),
          url: z.url(),
        }),
      )
      .min(1),
    feedback_entry: z.string(), // Google Form entry.XYZ field ID
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    order: z.number().int().positive(),
  }),
});

export const collections = { projects };
