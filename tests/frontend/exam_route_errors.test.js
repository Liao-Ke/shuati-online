// issue #154：/exam 是全部路由中唯一没有 try/catch 的。请求失败或
// activeExamId 损坏（parseInt 得 NaN → /api/exam/NaN → 422）时异常成为
// unhandled rejection，页面永久卡骨架屏。应与其他路由一致：给出可见错误
// 或回退答题设置页；考试已不存在时清掉快照避免反复撞同一错误。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadExamRoute({ store, getExamProgress }) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        style: {},
        classList: { add() {}, remove() {} },
        addEventListener() {},
      });
    }
    return elements.get(id);
  };
  const context = {
    console,
    location: { hash: '#/exam' },
    window: { addEventListener() {}, removeEventListener() {}, scrollY: 0, scrollTo() {} },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement() { return element(`__el${elements.size}`); },
      getElementById(id) { return element(id); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    api: { getExamProgress },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.router = router;`, context);
  return { context, elements, store, router: context.__exports.router };
}

test('损坏的 activeExamId 回退答题设置页并清掉快照', async () => {
  const { context, store, router } = loadExamRoute({
    store: { activeExamId: 'abc' },
    getExamProgress: async () => { throw new Error('不应发起请求'); },
  });
  await router.routes['/exam'].handler({});
  assert.equal(context.location.hash, '/exam/setup');
  assert.ok(!('activeExamId' in store), '损坏快照应被清掉');
});

test('考试不存在（404）渲染错误提示并清掉快照，不再永久骨架屏', async () => {
  const { elements, store, router } = loadExamRoute({
    store: { activeExamId: '42' },
    getExamProgress: async () => { const e = new Error('练习不存在'); e.status = 404; throw e; },
  });
  await router.routes['/exam'].handler({});
  const html = elements.get('content').innerHTML;
  assert.match(html, /加载失败\(404\)/);
  assert.match(html, /#\/exam\/setup/, '应提供返回答题设置入口');
  assert.ok(!('activeExamId' in store), '已删除考试的快照应被清掉');
});

test('网络失败渲染错误提示但保留快照，恢复后可继续', async () => {
  const { elements, store, router } = loadExamRoute({
    store: { activeExamId: '42' },
    getExamProgress: async () => { throw new TypeError('Failed to fetch'); },
  });
  await router.routes['/exam'].handler({});
  assert.match(elements.get('content').innerHTML, /加载失败/);
  assert.equal(store.activeExamId, '42', '瞬时网络失败不应销毁进行中考试的快照');
});
