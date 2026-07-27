// issue #151：单题倒计时生命周期泄漏的两条入口。
// 入口一：回看已作答题目（倒计时已清）时暂停→恢复，凭空重启 startTimer(0)，
//         1 秒后自动提交 → 无端 400 / 静默判错。
// 入口二：答题中经顶部导航离开考试页，倒计时在后台跑到归零后仍提交。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadTimerApp() {
  const timers = { started: [], cleared: [], nextId: 1 };
  const windowHandlers = {};
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: '', textContent: '', style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener() {},
      });
    }
    return elements.get(id);
  };
  const context = {
    console,
    location: { hash: '#/exam' },
    window: {
      addEventListener(type, fn) { (windowHandlers[type] ||= []).push(fn); },
      removeEventListener() {},
    },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement() { return element(`__el${elements.size}`); },
      getElementById(id) { return element(id); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval(fn, ms) { const id = timers.nextId++; timers.started.push(id); return id; },
    clearInterval(id) { if (id != null) timers.cleared.push(id); },
    setTimeout, clearTimeout,
    api: {},
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
__exports.startTimer = startTimer;
__exports.pauseExam = pauseExam;
__exports.resumeExam = resumeExam;`, context);
  const fireHashchange = () => (windowHandlers.hashchange || []).forEach((fn) => {
    try { fn(); } catch { /* router.resolve 的渲染副作用与本测试无关 */ }
  });
  return { context, timers, elements, fireHashchange, windowHandlers, exports: context.__exports };
}

test('入口一：无进行中倒计时时暂停→恢复不凭空重启计时器', () => {
  const { timers, exports } = loadTimerApp();
  // 回看已作答题：倒计时已清、#exam-timer 文本为空
  exports.pauseExam();
  exports.resumeExam();
  assert.deepEqual(timers.started, [], '不存在倒计时时恢复不应启动任何 interval');
});

test('入口一回归：真有倒计时时暂停→恢复按剩余秒数重启', () => {
  const { timers, elements, exports } = loadTimerApp();
  exports.startTimer(90);
  assert.equal(timers.started.length, 1);
  assert.equal(elements.get('exam-timer').textContent, '1:30');
  exports.pauseExam();
  assert.deepEqual(timers.cleared, [1], '暂停应清掉进行中的倒计时');
  exports.resumeExam();
  assert.equal(timers.started.length, 2, '恢复应重启倒计时');
  assert.equal(elements.get('exam-timer').textContent, '1:30', '按暂停时剩余秒数重启');
});

test('入口二：离开考试页即清掉倒计时，不再后台归零提交', () => {
  const { context, timers, exports, fireHashchange } = loadTimerApp();
  exports.startTimer(60);
  assert.equal(timers.started.length, 1);
  context.location.hash = '#/banks';
  fireHashchange();
  assert.ok(timers.cleared.includes(1), '离开考试页应清掉倒计时 interval');
});

test('入口二边界：仍在考试页时清理守卫不误清', () => {
  // 只触发清理监听器（注册顺序在 Router 之后，取末位）：全量触发会让 stub 里的
  // /exam 路由因无考试同步跳转 setup 改写 hash，那种场景下清理本就是正确行为
  const { context, timers, exports, windowHandlers } = loadTimerApp();
  exports.startTimer(60);
  context.location.hash = '#/exam';
  const cleanup = windowHandlers.hashchange.at(-1);
  cleanup();
  assert.deepEqual(timers.cleared, [], '仍在 /exam 时清理守卫不应清倒计时');
});
