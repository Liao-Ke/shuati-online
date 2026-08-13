// issue #160：已登录用户访问根路径（空 hash 回退 /login）或 #/login、#/register 时
// 应进入仪表盘，而不是渲染登录/注册表单。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const elementStub = () => ({
  innerHTML: '',
  textContent: '',
  classList: { add() {}, remove() {} },
  addEventListener() {},
});

function loadApp({ token, hash }) {
  const context = {
    console,
    location: { hash },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      createElement() { return elementStub(); },
      getElementById() { return elementStub(); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: {
      token,
      me: async () => ({ id: 1, username: 'tester' }),
      // 仪表盘路由渲染所需的最小桩
      getDashboardStats: async () => ({ bank_count: 0, question_count: 0, total_exams: 0, total_correct: 0, total_answered: 0, recent_exams: [] }),
      getUnfinishedExams: async () => [],
    },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.init = init;\n__exports.router = router;`, context);
  return { context, exports: context.__exports };
}

test('已登录用户访问根路径（空 hash）跳转仪表盘而非登录表单', async () => {
  const { context, exports } = loadApp({ token: 't', hash: '' });
  await exports.init();
  assert.equal(context.location.hash, '/dashboard');
});

test('已登录用户访问 #/register 同样跳转仪表盘', async () => {
  const { context, exports } = loadApp({ token: 't', hash: '#/register' });
  await exports.init();
  assert.equal(context.location.hash, '/dashboard');
});

test('未登录用户访问根路径仍停留在登录页', async () => {
  const { context, exports } = loadApp({ token: null, hash: '' });
  await exports.init();
  assert.equal(context.location.hash, '/login');
});
