/**
 * Cloudflare Worker — click tracking for WCUS 2026 Core AI Booth Site.
 *
 * Three routes (all GET, all public):
 *
 *   GET /r/:project/:target   → 302 to destination, increment click_outbound:project:target
 *   GET /feedback/:project    → 302 to Google Form, increment click_feedback:project:form
 *   GET /stats                → JSON dump of all counters
 *
 * No cookies, no PII, aggregate-only. See /privacy on the static site.
 *
 * Destination URLs and Google Form config come from projects.json, which is the
 * build-time-emitted source of truth shared with the content collection.
 */

import PROJECTS from './projects.json';

// TODO: replace with the real Google Form ID before deploy.
const FORM_ID = 'TODO_FORM_ID';

// KV namespace binding — set in wrangler.toml.
const KV_BINDING = 'COUNTERS';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ProjectConfig {
  name: string;
  links: Record<string, string>;
  feedback_entry: string;
}

/**
 * @param request - Fetch request
 * @param env - Worker environment, including KV bindings
 */
export default {
  async fetch(request: Request, env: { [key: string]: any }): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET /stats — JSON dump of all counters
    if (url.pathname === '/stats') {
      return handleStats(env);
    }

    // GET /r/:project/:target — tracked outbound redirect
    const outboundMatch = url.pathname.match(/^\/r\/([^/]+)\/([^/]+)$/);
    if (outboundMatch) {
      const [, projectSlug, target] = outboundMatch;
      return handleOutbound(env, projectSlug, target);
    }

    // GET /feedback/:project — tracked feedback redirect
    const feedbackMatch = url.pathname.match(/^\/feedback\/([^/]+)$/);
    if (feedbackMatch) {
      const [, projectSlug] = feedbackMatch;
      return handleFeedback(env, projectSlug);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleOutbound(
  env: { [key: string]: any },
  projectSlug: string,
  target: string,
): Promise<Response> {
  const project = (PROJECTS as Record<string, ProjectConfig>)[projectSlug];
  if (!project) {
    return new Response(`Unknown project: ${projectSlug}`, { status: 404 });
  }

  const destination = project.links[target];
  if (!destination) {
    return new Response(`Unknown target: ${target}`, { status: 404 });
  }

  await incrementCounter(env, `click_outbound:${projectSlug}:${target}`);
  return Response.redirect(destination, 302);
}

async function handleFeedback(env: { [key: string]: any }, projectSlug: string): Promise<Response> {
  const project = (PROJECTS as Record<string, ProjectConfig>)[projectSlug];
  if (!project) {
    return new Response(`Unknown project: ${projectSlug}`, { status: 404 });
  }

  if (FORM_ID === 'TODO_FORM_ID') {
    return new Response('Feedback form not yet configured', { status: 503 });
  }

  const destination = buildFeedbackUrl(project);
  await incrementCounter(env, `click_feedback:${projectSlug}:form`);
  return Response.redirect(destination, 302);
}

async function handleStats(env: { [key: string]: any }): Promise<Response> {
  const kv = env[KV_BINDING];
  if (!kv) {
    return new Response('KV namespace not bound', { status: 500 });
  }

  const listResult = await kv.list();
  const entries = await Promise.all(
    listResult.keys.map(async (key: { name: string }) => {
      const value = await kv.get(key.name);
      return [key.name, parseInt(value || '0', 10)] as const;
    }),
  );

  const stats = assembleStats(entries);

  return new Response(JSON.stringify(stats, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...CORS_HEADERS,
    },
  });
}

async function incrementCounter(env: { [key: string]: any }, key: string): Promise<void> {
  const kv = env[KV_BINDING];
  if (!kv) return;
  const current = parseInt((await kv.get(key)) || '0', 10);
  await kv.put(key, String(current + 1));
}

function buildFeedbackUrl(project: ProjectConfig): string {
  const base = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
  const params = new URLSearchParams({
    [project.feedback_entry]: project.name,
  });
  return `${base}?${params.toString()}`;
}

/**
 * Convert flat KV keys like "click_outbound:abilities-api:repo" into a nested
 * structure: { click_outbound: { "abilities-api": { repo: 47, docs: 12 } }, ... }
 */
function assembleStats(
  entries: ReadonlyArray<readonly [string, number]>,
): Record<string, Record<string, Record<string, number>>> {
  const stats: Record<string, Record<string, Record<string, number>>> = {};
  for (const [key, count] of entries) {
    const [eventKind, project, target] = key.split(':');
    if (!eventKind || !project || !target) continue;
    if (!stats[eventKind]) stats[eventKind] = {};
    if (!stats[eventKind][project]) stats[eventKind][project] = {};
    stats[eventKind][project][target] = count;
  }
  return stats;
}
