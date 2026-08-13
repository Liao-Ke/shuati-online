const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #155：sessionStorage.reviewFilter 为非法 JSON 时，init() 与 /review 路由
// 的 JSON.parse 抛异常导致启动白屏卡死。统一走 safeSessionJSON：损坏值按不存在
// 处理并清掉，启动流程照常走到 router.resolve()。

const elementStub = () => ({
  innerHTML: '',
  textContent: '',
  classList: { add() {}, remove() {} },
  addEventListener() {},
});

function loadApp(store) {
  const removed = [];
  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      createElement() { return elementStub(); },
      getElementById() { return elementStub(); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { removed.push(k); delete store[k]; },
    },
    api: { token: null },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
__exports.init = init;
__exports.router = router;
__exports.safeSessionJSON = safeSessionJSON;`, context);
  return { exports: context.__exports, context, removed };
}

test('safeSessionJSON 损坏值回退 fallback 并清掉该 key', () => {
  const { exports, removed } = loadApp({ reviewFilter: '{bad json' });
  assert.equal(exports.safeSessionJSON('reviewFilter', null), null);
  assert.ok(removed.includes('reviewFilter'));
});

test('safeSessionJSON 正常值解析、缺失值回退且不误删', () => {
  const { exports, removed } = loadApp({ reviewFilter: '{"bank_ids":[1]}' });
  // vm 内解析出的对象与测试进程原型不同源，用 JSON 序列化比较
  assert.equal(JSON.stringify(exports.safeSessionJSON('reviewFilter', null)), '{"bank_ids":[1]}');
  assert.equal(JSON.stringify(exports.safeSessionJSON('missing', { a: 1 })), '{"a":1}');
  assert.deepEqual(removed, []);
});

test('init() 在 reviewFilter 损坏时不再中断启动，照常走到 router.resolve', async () => {
  const { exports, removed } = loadApp({ reviewFilter: '{bad json' });
  let resolved = false;
  exports.router.resolve = () => { resolved = true; };
  await exports.init();
  assert.ok(resolved, '启动流程应走到 router.resolve()');
  assert.ok(removed.includes('reviewFilter'), '损坏值应被清掉，避免每次刷新重复触发');
});

test('/review 路由在 reviewFilter 损坏时回退到 /review/setup 而非抛异常', async () => {
  const { exports, context } = loadApp({ reviewFilter: '{bad json' });
  context.location.hash = '#/review';
  await exports.router.routes['/review'].handler({});
  assert.equal(context.location.hash, '/review/setup');
});
