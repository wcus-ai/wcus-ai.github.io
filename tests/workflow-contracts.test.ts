import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';

const workflowsDir = new URL('../.github/workflows/', import.meta.url);

// eslint-disable-next-line typescript/no-explicit-any -- workflow YAML shape is arbitrary and only spot-checked here
async function loadWorkflow(name: string): Promise<any> {
  const raw = await readFile(new URL(name, workflowsDir), 'utf8');
  return parse(raw);
}

test('preview.yml: runs on pull_request with full lifecycle types', async () => {
  const wf = await loadWorkflow('preview.yml');
  const types = wf.on?.pull_request?.types ?? wf['true']?.pull_request?.types;
  assert.ok(types, 'preview.yml must trigger on pull_request');
  for (const type of ['opened', 'synchronize', 'reopened', 'closed']) {
    assert.ok(types.includes(type), `pull_request types must include ${type}`);
  }
});

test('preview.yml: read-only permissions only — safe for fork PRs', async () => {
  const wf = await loadWorkflow('preview.yml');
  const permissions = wf.permissions ?? wf.jobs?.preview?.permissions;
  assert.deepEqual(permissions, { contents: 'read' });
});

test('preview.yml: never sets PUBLIC_TRACKING_ENDPOINT (tracking disabled on previews)', async () => {
  const raw = await readFile(new URL('preview.yml', workflowsDir), 'utf8');
  assert.ok(
    !raw.includes('PUBLIC_TRACKING_ENDPOINT'),
    'preview build must not set the tracking endpoint',
  );
  assert.ok(
    !raw.includes('workers.dev/track'),
    'preview build must not reference the production tracking worker',
  );
});

test('preview.yml: no pull_request_target trigger', async () => {
  const raw = await readFile(new URL('preview.yml', workflowsDir), 'utf8');
  assert.ok(
    !raw.includes('pull_request_target'),
    'untrusted PR code must never run with a privileged token',
  );
});

test('preview.yml: concurrency is scoped per PR', async () => {
  const wf = await loadWorkflow('preview.yml');
  const group = wf.concurrency?.group ?? '';
  assert.match(
    group,
    /pull_request\.number|event\.number|head_ref/,
    'concurrency group must key on the PR',
  );
});

test('preview.yml: builds with the PR preview base path', async () => {
  const raw = await readFile(new URL('preview.yml', workflowsDir), 'utf8');
  assert.ok(raw.includes('--base'), 'build must pass --base /pr-preview/pr-N/');
  assert.ok(raw.includes('pr-preview'), 'base path must use the pr-preview prefix');
});

test('preview-publish.yml: triggered only by PR Preview workflow_run completion', async () => {
  const wf = await loadWorkflow('preview-publish.yml');
  const run = wf.on?.workflow_run ?? wf['true']?.workflow_run;
  assert.ok(run, 'preview-publish.yml must trigger on workflow_run');
  const workflows = Array.isArray(run) ? run : run.workflows;
  assert.ok(
    workflows?.includes('PR Preview'),
    'workflow_run must filter on the PR Preview workflow',
  );
});

test('preview-publish.yml: has the permissions it needs and no more', async () => {
  const wf = await loadWorkflow('preview-publish.yml');
  assert.equal(wf.permissions?.contents, 'write');
  assert.equal(wf.permissions?.['pull-requests'], 'write');
  assert.equal(wf.permissions?.actions, 'write');
  assert.ok(!wf.permissions?.pages, 'branch-mode publishing needs no pages permission');
  assert.ok(!wf.permissions?.['id-token'], 'branch-mode publishing needs no id-token permission');
});

test('preview-publish.yml: never checks out PR head code (trusted context)', async () => {
  const raw = await readFile(new URL('preview-publish.yml', workflowsDir), 'utf8');
  assert.ok(!raw.includes('pull_request_target'));
  assert.ok(!raw.includes('refs/pull/'), 'publisher must not check out contributor code');
  const wf = await loadWorkflow('preview-publish.yml');
  const checkoutRefs: string[] = [];
  // eslint-disable-next-line typescript/no-explicit-any -- workflow YAML shape is arbitrary and only spot-checked here
  for (const job of Object.values(wf.jobs ?? {}) as any[]) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses === 'string' && step.uses.startsWith('actions/checkout')) {
        if (step.with?.ref) checkoutRefs.push(step.with.ref);
      }
    }
  }
  for (const ref of checkoutRefs) {
    assert.equal(ref, 'gh-pages', 'any checkout in the publisher must pin ref gh-pages');
  }
});

test('preview-publish.yml: deploys under pr-preview/pr-N and replaces prior content', async () => {
  const raw = await readFile(new URL('preview-publish.yml', workflowsDir), 'utf8');
  assert.ok(raw.includes('pr-preview/pr-'), 'publisher must deploy into pr-preview/pr-N/');
  assert.ok(
    /rm -rf|--force|clean/.test(raw),
    'publisher must replace, not merge, old preview files',
  );
});

test('preview-publish.yml: deletes superseded PR artifacts', async () => {
  const raw = await readFile(new URL('preview-publish.yml', workflowsDir), 'utf8');
  assert.ok(raw.includes('DELETE'), 'publisher must call the artifact delete API');
});

test('preview-publish.yml: updates a single keyed PR comment, not a new one each run', async () => {
  const raw = await readFile(new URL('preview-publish.yml', workflowsDir), 'utf8');
  assert.ok(
    raw.includes('pr-preview-report'),
    'comment upsert must key on the pr-preview-report marker',
  );
  assert.ok(
    raw.includes('PATCH') || raw.includes('updateComment') || raw.includes('issues/comments'),
    'comment upsert must update an existing comment when present',
  );
});

test('deploy.yml: production publishes to gh-pages root preserving pr-preview/', async () => {
  const raw = await readFile(new URL('deploy.yml', workflowsDir), 'utf8');
  assert.ok(raw.includes('gh-pages'), 'production deploy must publish to the gh-pages branch');
  assert.ok(
    raw.includes('pr-preview'),
    'production deploy must preserve the pr-preview umbrella directory',
  );
  assert.ok(
    !raw.includes('upload-pages-artifact') && !raw.includes('deploy-pages'),
    'Actions-mode Pages deploy must be retired',
  );
});

test('workflow files exist and parse', async () => {
  const names = await readdir(workflowsDir);
  for (const required of ['preview.yml', 'preview-publish.yml', 'deploy.yml']) {
    assert.ok(names.includes(required), `${required} must exist`);
  }
});
