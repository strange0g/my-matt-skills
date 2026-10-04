import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseGitRemote,
  loadApiKey,
  loadSessionRegistry,
  saveSessionRegistry,
  recordSession,
  makeJulesRequest,
  dispatchTask,
  getSessionStatus,
  sendMessage,
  waitForSession
} from '../scripts/jules.mjs';

test('parseGitRemote correctly parses GitHub remotes', () => {
  assert.equal(
    parseGitRemote('git@github.com:strange0g/my-matt-skills.git'),
    'strange0g/my-matt-skills'
  );
  assert.equal(
    parseGitRemote('https://github.com/strange0g/my-matt-skills.git'),
    'strange0g/my-matt-skills'
  );
  assert.equal(
    parseGitRemote('https://github.com/mattpocock/skills'),
    'mattpocock/skills'
  );
  assert.equal(parseGitRemote('invalid-remote'), null);
  assert.equal(parseGitRemote(null), null);
});

test('loadApiKey retrieves key correctly', () => {
  assert.equal(loadApiKey('custom_test_key'), 'custom_test_key');
  const loaded = loadApiKey();
  assert.ok(loaded && loaded.length > 0, 'Should load key from environment or .env');
});

test('Session Registry records and updates sessions atomically', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'jules-test-'));
  const testRegistryFile = join(tempDir, 'sessions.json');

  try {
    const initial = loadSessionRegistry(testRegistryFile);
    assert.deepEqual(initial, []);

    recordSession({
      sessionId: 'sessions/100',
      role: 'coder',
      state: 'QUEUED'
    }, testRegistryFile);

    let loaded = loadSessionRegistry(testRegistryFile);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].sessionId, 'sessions/100');
    assert.equal(loaded[0].state, 'QUEUED');

    recordSession({
      sessionId: 'sessions/100',
      state: 'COMPLETED',
      prUrl: 'https://github.com/test/repo/pull/1'
    }, testRegistryFile);

    loaded = loadSessionRegistry(testRegistryFile);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].state, 'COMPLETED');
    assert.equal(loaded[0].prUrl, 'https://github.com/test/repo/pull/1');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Mock Jules API integration tests', async (t) => {
  let mockState = 'QUEUED';
  let messageReceived = null;

  const server = http.createServer((req, res) => {
    const authHeader = req.headers['x-goog-api-key'];
    if (authHeader === 'invalid_key') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API Key' } }));
      return;
    }

    if (req.url === '/sources' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sources: [{ name: 'sources/github/test/repo' }]
      }));
      return;
    }

    if (req.url === '/sessions' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'sessions/mock-123',
          state: 'QUEUED',
          title: parsed.title
        }));
      });
      return;
    }

    if (req.url === '/sessions/mock-123' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'sessions/mock-123',
        state: mockState,
        outputs: mockState === 'COMPLETED' ? [
          { pullRequest: { url: 'https://github.com/test/repo/pull/99', number: 99 } }
        ] : []
      }));
      return;
    }

    if (req.url === '/sessions/mock-123:sendMessage' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const parsed = JSON.parse(body);
        messageReceived = parsed.prompt;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const mockApiBase = `http://127.0.0.1:${port}`;
  const config = { apiBase: mockApiBase, apiKey: 'test_key' };

  try {
    await t.test('handles 401 unauthorized errors', async () => {
      await assert.rejects(
        async () => {
          await makeJulesRequest('/sources', {}, { apiBase: mockApiBase, apiKey: 'invalid_key' });
        },
        /Jules API error \(401\)/
      );
    });

    await t.test('dispatches task successfully', async () => {
      const result = await dispatchTask({
        prompt: 'Build test feature',
        repo: 'test/repo',
        role: 'coder',
        config
      });
      assert.equal(result.name, 'sessions/mock-123');
      assert.equal(result.record.state, 'QUEUED');
      assert.equal(result.record.role, 'coder');
    });

    await t.test('checks session status and detects PR url upon completion', async () => {
      let status = await getSessionStatus('sessions/mock-123', config);
      assert.equal(status.state, 'QUEUED');
      assert.equal(status.prUrl, null);

      mockState = 'COMPLETED';
      status = await getSessionStatus('sessions/mock-123', config);
      assert.equal(status.state, 'COMPLETED');
      assert.equal(status.prUrl, 'https://github.com/test/repo/pull/99');
    });

    await t.test('sends message feedback', async () => {
      await sendMessage('sessions/mock-123', 'Please add unit test', config);
      assert.equal(messageReceived, 'Please add unit test');
    });

    await t.test('waitForSession completes when session is COMPLETED', async () => {
      const finalStatus = await waitForSession('sessions/mock-123', {
        pollIntervalMs: 50,
        timeoutMs: 1000,
        config
      });
      assert.equal(finalStatus.state, 'COMPLETED');
      assert.equal(finalStatus.prUrl, 'https://github.com/test/repo/pull/99');
    });
  } finally {
    server.close();
  }
});
