const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadApi(fetchImpl) {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/api.js'), 'utf8');
  const storage = new Map();
  const events = [];
  const context = {
    fetch: fetchImpl,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    window: { dispatchEvent(event) { events.push(event.type); } },
    CustomEvent: function CustomEvent(type) { this.type = type; },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n__exports.api = api;`, context);
  return { api: context.__exports.api, events, storage };
}

test('api request exposes HTTP status on thrown errors', async () => {
  const { api } = loadApi(async () => ({
    ok: false,
    status: 409,
    async json() { return { detail: '考试尚未完成' }; },
  }));

  await assert.rejects(
    () => api.getExamResult(42),
    (err) => {
      assert.equal(err.message, '考试尚未完成');
      assert.equal(err.status, 409);
      return true;
    },
  );
});

test('api request still handles non-auth 401 by clearing token', async () => {
  const { api, events, storage } = loadApi(async () => ({
    ok: false,
    status: 401,
    async json() { return { detail: '登录已过期' }; },
  }));
  api.setToken('token');

  await assert.rejects(() => api.getBanks(), /登录已过期/);

  assert.equal(storage.get('token'), undefined);
  assert.deepEqual(events, ['auth-expired']);
});

test('api request maps 429 rate limit responses to friendly message', async () => {
  const { api, events } = loadApi(async () => ({
    ok: false,
    status: 429,
    async json() { return { error: 'Rate limit exceeded: 5 per 1 minute' }; },
  }));

  await assert.rejects(
    () => api.login('u', 'p'),
    (err) => {
      assert.equal(err.message, '请求过于频繁，请稍后重试');
      assert.equal(err.status, 429);
      return true;
    },
  );
  assert.deepEqual(events, []);
});

test('api request falls back to error field for non-429 responses', async () => {
  const { api } = loadApi(async () => ({
    ok: false,
    status: 400,
    async json() { return { error: '自定义错误' }; },
  }));

  await assert.rejects(() => api.getBanks(), /自定义错误/);
});

// issue #157：网关 HTML 错误页/空 body 不是 JSON 时，request 不再抛 SyntaxError 原文，
// 统一产生带状态码的可读错误，err.status 保持可用。

test('api request maps non-JSON 502 error page to readable message with status', async () => {
  const { api } = loadApi(async () => ({
    ok: false,
    status: 502,
    async json() { throw new SyntaxError("Unexpected token '<'"); },
  }));

  await assert.rejects(
    () => api.getBanks(),
    (err) => {
      assert.equal(err.message, '请求失败(502)');
      assert.equal(err.status, 502);
      return true;
    },
  );
});

test('api request maps empty-body 500 to readable message with status', async () => {
  const { api } = loadApi(async () => ({
    ok: false,
    status: 500,
    async json() { throw new SyntaxError('Unexpected end of JSON input'); },
  }));

  await assert.rejects(
    () => api.getBanks(),
    (err) => {
      assert.equal(err.message, '请求失败(500)');
      assert.equal(err.status, 500);
      return true;
    },
  );
});

test('api request non-JSON 401 still triggers auth-expired handling', async () => {
  const { api, events, storage } = loadApi(async () => ({
    ok: false,
    status: 401,
    async json() { throw new SyntaxError("Unexpected token '<'"); },
  }));
  api.setToken('token');

  await assert.rejects(() => api.getBanks(), /请求失败\(401\)/);
  assert.equal(storage.get('token'), undefined);
  assert.deepEqual(events, ['auth-expired']);
});

test('api request treats non-JSON body on 200 as parse failure with status', async () => {
  const { api } = loadApi(async () => ({
    ok: true,
    status: 200,
    async json() { throw new SyntaxError("Unexpected token '<'"); },
  }));

  await assert.rejects(
    () => api.getBanks(),
    (err) => {
      assert.equal(err.message, '响应解析失败(200)');
      assert.equal(err.status, 200);
      return true;
    },
  );
});
