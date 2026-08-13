// issue #158：后端返回无时区后缀的 naive UTC isoformat，题库卡片「更新于」
// 直接 new Date() 按本地时间解析，UTC+8 凌晨时段显示早一天。
// 应与 started_at 各展示点一致走 parseUtcDate（补 Z 后缀）。
process.env.TZ = 'Asia/Shanghai';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadApp(banks) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        classList: { add() {}, remove() {} },
        addEventListener() {},
      });
    }
    return elements.get(id);
  };
  const context = {
    console,
    location: { hash: '#/banks' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      createElement() { return element(`__el${elements.size}`); },
      getElementById(id) { return element(id); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: { token: 't', getBanks: async () => banks },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.router = router;`, context);
  return { context, elements, router: context.__exports.router };
}

test('题库卡片「更新于」按 UTC 解析：UTC 深夜时间在 UTC+8 显示为次日本地日期', async () => {
  // naive UTC 2026-07-26 23:30 = 本地（UTC+8）2026-07-27 07:30
  const { router, elements } = loadApp([{
    id: 1, title: '时区题库', description: '', question_count: 5,
    created_at: '2026-07-26T23:30:00.000000', updated_at: '2026-07-26T23:30:00.000000',
  }]);
  await router.routes['/banks'].handler({});
  const html = elements.get('bank-list').innerHTML;
  assert.match(html, /更新于 2026\/7\/27/, `应显示本地日期 7/27，实际渲染：${html.match(/更新于 [^<]+/)?.[0]}`);
});
