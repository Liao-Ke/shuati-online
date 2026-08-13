// issue #153：删除题库成功后原代码 router.navigate('/banks')，但当前 hash 已是
// #/banks，同值赋值不触发 hashchange，列表不刷新。应与 doDeleteQuestion 同口径
// 用 router.resolve() 强制重渲染。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const elementStub = () => ({
  innerHTML: '',
  textContent: '题库A',
  classList: { add() {}, remove() {} },
  addEventListener() {},
  closest() { return null; },
});

test('删除题库成功后强制重渲染当前路由，而非同 hash 的 no-op navigate', async () => {
  let deleted = false;
  const context = {
    console,
    location: { hash: '#/banks' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      createElement() { return elementStub(); },
      getElementById() { return elementStub(); },
      querySelector() { return elementStub(); },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    confirm: () => true,
    alert: (m) => { throw new Error(`不应弹错误: ${m}`); },
    api: { deleteBank: async () => { deleted = true; return null; } },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
__exports.router = router;
__exports.confirmDeleteBank = confirmDeleteBank;`, context);

  let resolved = false;
  context.__exports.router.resolve = () => { resolved = true; };

  context.__exports.confirmDeleteBank(1);
  await new Promise((r) => setTimeout(r, 0));

  assert.ok(deleted, 'deleteBank 应被调用');
  assert.ok(resolved, '删除成功后应 router.resolve() 重渲染列表');
  assert.equal(context.location.hash, '#/banks', '不应依赖同 hash 的 navigate');
});
