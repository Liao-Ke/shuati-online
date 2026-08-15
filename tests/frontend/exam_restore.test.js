const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #110：考试页刷新（F5）后 JS 状态清零，/exam 路由恢复流程若不同步
// examTotalCount，navigateExam 的边界判断恒成立，「上一题/下一题」按钮静默失效。
function loadExamRoute() {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const storage = new Map([['activeExamId', '42']]);
  const documentStub = {
    elements: new Map(),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) {
      if (!this.elements.has(id)) {
        const classes = new Set();
        this.elements.set(id, {
          textContent: '',
          innerHTML: '',
          value: '',
          style: {},
          disabled: false,
          classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); },
            toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
          },
        });
      }
      return this.elements.get(id);
    },
  };
  const context = {
    console,
    // 模拟真实考试页 hash：#151 的 stale-guard 只放行 /exam 路由上的切题响应
    location: { hash: '#/exam' },
    window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} },
    setTimeout() {},
    clearInterval() {},
    clearTimeout() {},
    document: documentStub,
    api: {
      getExamProgress: async () => ({ total_count: 3, current_index: 0, answers: [] }),
      // 返回 question:null 让 loadQuestionByIndex 走“无题跳结果页”分支，不影响恢复流程断言
      getCurrentQuestion: async () => ({ question: null }),
    },
    sessionStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}
__exports.examRouteHandler = router.routes['/exam'].handler;
__exports.getExamTotalCount = () => examTotalCount;`, context);
  return context.__exports;
}

test('exam restore flow syncs examTotalCount from progress API (issue #110)', async () => {
  const { examRouteHandler, getExamTotalCount } = loadExamRoute();
  await examRouteHandler({});
  assert.equal(getExamTotalCount(), 3);
});
