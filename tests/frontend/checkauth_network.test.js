// issue #156：checkAuth 把所有 api.me() 异常一视同仁清 token。网络层失败
// （fetch 抛 TypeError，无 err.status）不应销毁本地凭证——服务恢复后刷新
// 即可恢复会话；只有服务端明确 401 才清 token。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCheckAuth(meImpl) {
  const calls = { setToken: [] };
  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: {
      token: 'valid-token',
      me: meImpl,
      setToken(v) { calls.setToken.push(v); this.token = v; },
    },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.checkAuth = checkAuth;`, context);
  return { checkAuth: context.__exports.checkAuth, calls, context };
}

test('网络失败（无 err.status）不清 token，返回未认证', async () => {
  const { checkAuth, calls } = loadCheckAuth(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await checkAuth(), false);
  assert.deepEqual(calls.setToken, [], '网络失败不应销毁本地凭证');
});

test('服务端 500（非 401）同样保留 token', async () => {
  const { checkAuth, calls } = loadCheckAuth(async () => {
    const err = new Error('服务器错误');
    err.status = 500;
    throw err;
  });
  assert.equal(await checkAuth(), false);
  assert.deepEqual(calls.setToken, []);
});

test('服务端明确 401 才清 token', async () => {
  const { checkAuth, calls } = loadCheckAuth(async () => {
    const err = new Error('登录已过期');
    err.status = 401;
    throw err;
  });
  assert.equal(await checkAuth(), false);
  assert.deepEqual(calls.setToken, [null]);
});

test('token 有效时正常认证', async () => {
  const { checkAuth, calls } = loadCheckAuth(async () => ({ id: 1, username: 'u' }));
  assert.equal(await checkAuth(), true);
  assert.deepEqual(calls.setToken, []);
});
