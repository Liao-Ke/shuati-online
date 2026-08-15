const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #44：跨会话恢复未完成考试时 sessionStorage 没有 examCurrentIndex，
// /exam 路由应根据 progress 定位到第一道未答题，而不是停在第 0 题。
function loadExamRoute({ storageEntries, progress }) {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const storage = new Map(storageEntries);
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
      getExamProgress: async () => progress,
      // 返回 question:null 让 loadQuestionByIndex 走“无题跳结果页”分支，不影响定位断言
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
__exports.getExamCurrentIndex = () => examCurrentIndex;`, context);
  return context.__exports;
}

test('cross-session resume positions to first unanswered question (issue #44)', async () => {
  const { examRouteHandler, getExamCurrentIndex } = loadExamRoute({
    storageEntries: [['activeExamId', '42']],
    progress: {
      total_count: 5,
      current_index: 0,
      answers: [
        { index: 0, is_correct: true },
        { index: 1, is_correct: false },
        { index: 3, is_correct: true },
      ],
    },
  });
  await examRouteHandler({});
  assert.equal(getExamCurrentIndex(), 2);
});

test('saved examCurrentIndex still wins over first-unanswered positioning', async () => {
  const { examRouteHandler, getExamCurrentIndex } = loadExamRoute({
    storageEntries: [['activeExamId', '42'], ['examCurrentIndex', '4']],
    progress: {
      total_count: 5,
      current_index: 0,
      answers: [{ index: 0, is_correct: true }],
    },
  });
  await examRouteHandler({});
  assert.equal(getExamCurrentIndex(), 4);
});

test('fresh exam with no answers stays at question 0', async () => {
  const { examRouteHandler, getExamCurrentIndex } = loadExamRoute({
    storageEntries: [['activeExamId', '42']],
    progress: { total_count: 3, current_index: 0, answers: [] },
  });
  await examRouteHandler({});
  assert.equal(getExamCurrentIndex(), 0);
});
