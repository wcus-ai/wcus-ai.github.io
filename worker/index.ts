/**
 * Cloudflare Worker — click tracking beacon.
 *
 * Single route: POST /track
 *
 * Stats are viewed in the Cloudflare dashboard (Analytics Engine → WCUS_AI_Booth). Query with SQL via the Workers dashboard or GraphQL API.
 *
 * Blob layout (positional, must stay stable across all writes):
 *   blob1 = event    ("click_outbound" | "click_internal" | "click_feedback")
 *   blob2 = project  (one of PROJECT_SLUGS, or "site" for site-wide links)
 *   blob3 = target   (stable identifier — e.g., "repo", "project-card", "form")
 */

type ClickEventKind = 'click_outbound' | 'click_internal' | 'click_feedback';

interface TrackPayload {
  event: ClickEventKind;
  project: string;
  target?: string;
}

interface AnalyticsEngineDataset {
  writeDataPoint(dataPoint: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
    timestamp?: number;
  }): void;
}

interface Env {
  ANALYTICS: AnalyticsEngineDataset;
}

/** Single sampling key — aggregate counts span the whole dataset. */
const INDEX = 'wcus-clicks';

/** Allowed project slugs. Rejects unknown projects to keep the dataset clean. */
const PROJECT_SLUGS: ReadonlySet<string> = new Set([
  'abilities-api',
  'agent-skills',
  'ai-client',
  'ai-plugin',
  'mcp-adapter',
  'wp-bench',
  'site',
]);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function isClickEventKind(value: unknown): value is ClickEventKind {
  return value === 'click_outbound' || value === 'click_internal' || value === 'click_feedback';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/track' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }

    let payload: TrackPayload;
    try {
      payload = (await request.json()) as TrackPayload;
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
    }

    if (
      !isClickEventKind(payload.event) ||
      typeof payload.project !== 'string' ||
      !PROJECT_SLUGS.has(payload.project)
    ) {
      return new Response('Invalid payload', { status: 400, headers: CORS_HEADERS });
    }

    env.ANALYTICS.writeDataPoint({
      indexes: [INDEX],
      blobs: [payload.event, payload.project, payload.target ?? ''],
      doubles: [1],
    });

    return new Response(null, { status: 204, headers: CORS_HEADERS });
  },
};
