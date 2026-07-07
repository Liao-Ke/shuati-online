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
