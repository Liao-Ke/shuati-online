// issue #151：单题倒计时生命周期泄漏的两条入口。
// 入口一：回看已作答题目（倒计时已清）时暂停→恢复，凭空重启 startTimer(0)，
//         1 秒后自动提交 → 无端 400 / 静默判错。
//         根因是历史上多处只 clearInterval 不把 examTimerInterval 置 null，
//         陈旧 ID 让暂停守卫误判“有进行中的倒计时”，本套件覆盖全部停表路径。
// 入口二：答题中经顶部导航离开考试页，倒计时在后台跑到归零后仍提交。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadTimerApp({ api = {}, confirm = () => true } = {}) {
  const timers = { started: [], cleared: [], nextId: 1, callbacks: new Map() };
  const windowHandlers = {};
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        innerHTML: '', textContent: '', style: {}, className: '', disabled: false, value: '',
        classList: {
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          contains(name) { return classes.has(name); },
        },
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
      });
    }
    return elements.get(id);
  };
  const alerts = [];
  const context = {
    console,
    alert(message) { alerts.push(String(message)); },
    confirm,
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
    setInterval(fn, ms) {
      const id = timers.nextId++;
      timers.started.push(id);
      timers.callbacks.set(id, fn);
      return id;
    },
    clearInterval(id) {
      if (id != null) {
        timers.cleared.push(id);
        timers.callbacks.delete(id);
      }
    },
    setTimeout, clearTimeout,
    api,
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
__exports.startTimer = startTimer;
__exports.pauseExam = pauseExam;
__exports.resumeExam = resumeExam;
__exports.loadQuestionByIndex = loadQuestionByIndex;
__exports.submitCurrentAnswer = submitCurrentAnswer;
__exports.finishExam = finishExam;
__exports.setExamContext = (opts = {}) => {
  examId = opts.examId ?? 42;
  examTotalCount = opts.totalCount ?? 1;
  examCurrentIndex = 0;
  examTimerMode = 'per_question';
  examFullPreview = false;
  examPaused = false;
  examPauseRemaining = null;
  examProgress = { total_count: examTotalCount, answers: opts.answers ?? [] };
  state.questionStartTime = opts.questionStartTime ?? Date.now();
};
__exports.timerState = () => ({
  interval: examTimerInterval,
  paused: examPaused,
  pauseRemaining: examPauseRemaining,
  pending: examPendingTimer,
});`, context);
  timers.fire = (id) => {
    const callback = timers.callbacks.get(id);
    assert.ok(callback, `interval ${id} 不存在或已被清理`);
    callback();
  };
  const fireHashchange = () => (windowHandlers.hashchange || []).forEach((fn) => {
    try { fn(); } catch { /* router.resolve 的渲染副作用与本测试无关 */ }
  });
  // setImmediate 让 vm 内所有已排队的微任务先清空，再继续断言异步收尾
  const flushAsync = () => new Promise((resolve) => setImmediate(resolve));
  return { context, timers, elements, fireHashchange, windowHandlers, flushAsync, alerts, exports: context.__exports };
}

// 已作答题的 API 返回体，模拟提交/回看后 loadQuestionByIndex 的渲染分支
function answeredQuestionData() {
  return {
    question: { id: 1, type: 'fill', content: '1+1=?', options: null, chapter: null, analysis: null },
    is_answered: true,
    is_correct: true,
    user_answer: '2',
    correct_answer: '2',
    total_count: 1,
  };
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
  context.location.hash = '#/exam?tab=1'; // 守卫与 showNav 同口径：忽略 query 串
  cleanup();
  assert.deepEqual(timers.cleared, [], '带 query 的 /exam 也不应被误判为已离开');
});

test('入口二边界：切题请求在途时离开考试页，完成后不启动后台倒计时', async () => {
  let resolveQuestion;
  const api = {
    getCurrentQuestion: () => new Promise((resolve) => { resolveQuestion = resolve; }),
  };
  const { context, timers, elements, exports } = loadTimerApp({ api });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  const loading = exports.loadQuestionByIndex(0);
  context.location.hash = '#/banks'; // 请求在途时离开考试页
  resolveQuestion({
    question: { id: 1, type: 'fill', content: '1+1=?', options: null, chapter: null, analysis: null, blank_count: 1 },
    is_answered: false,
    total_count: 1,
  });
  await loading;
  assert.deepEqual(timers.started, [], '离开考试页后切题完成不得启动倒计时');
  assert.equal(elements.get('exam-content'), undefined, '过期响应不得渲染旧题');
  assert.equal(exports.timerState().interval, null);
});

test('入口二异步边界：旧考试切题请求在途时开启新考试，完成后丢弃过期响应', async () => {
  let resolveQuestion;
  const api = {
    getCurrentQuestion: () => new Promise((resolve) => { resolveQuestion = resolve; }),
  };
  const { context, timers, elements, exports } = loadTimerApp({ api });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  const loading = exports.loadQuestionByIndex(0);
  // 请求在途期间开启新考试：仍在 /exam 路由，但 examId 已切换，
  // 旧响应只能靠 examId 分支丢弃，否则会用新 examId 渲染旧题并启动倒计时
  exports.setExamContext({ examId: 99, totalCount: 1 });
  resolveQuestion({
    question: { id: 1, type: 'fill', content: '1+1=?', options: null, chapter: null, analysis: null, blank_count: 1 },
    is_answered: false,
    total_count: 1,
  });
  await loading;
  assert.equal(elements.get('exam-content'), undefined, '过期响应不得渲染旧题');
  assert.deepEqual(timers.started, [], '过期响应不得启动后台倒计时');
  assert.equal(exports.timerState().interval, null, '不得残留倒计时引用');
});

test('入口一主复现：回看已作答题（切题停表）后暂停→继续不重启计时器', async () => {
  const { timers, elements, exports } = loadTimerApp({
    api: { getCurrentQuestion: async () => answeredQuestionData() },
  });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  exports.startTimer(60);
  await exports.loadQuestionByIndex(0);
  assert.equal(elements.get('exam-timer').textContent, '', '已作答题的倒计时区应清空');
  assert.equal(exports.timerState().interval, null, '切题停表后 interval 引用必须置空');
  exports.pauseExam();
  assert.equal(exports.timerState().pauseRemaining, null, '无进行中倒计时时暂停剩余应为 null');
  exports.resumeExam();
  assert.equal(timers.started.length, 1, '恢复不得凭空启动第 2 条 interval');
});

test('入口一提交路径：手动提交停表后暂停→继续不重启、不重复提交', async () => {
  let submitted = 0;
  const api = {
    getCurrentQuestion: async () => submitted === 0
      ? {
        question: { id: 1, type: 'fill', content: '1+1=?', options: null, chapter: null, analysis: null, blank_count: 1 },
        is_answered: false,
        total_count: 1,
      }
      : answeredQuestionData(),
    submitAnswer: async () => { submitted += 1; },
    getExamProgress: async () => ({ total_count: 1, answers: [{ index: 0, is_correct: true }] }),
  };
  const { timers, elements, exports, flushAsync } = loadTimerApp({ api });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  exports.startTimer(60);
  await exports.submitCurrentAnswer();
  await flushAsync(); // 等 submitCurrentAnswer 内部启动的 loadQuestionByIndex 渲染完成
  assert.equal(submitted, 1);
  assert.equal(elements.get('exam-timer').textContent, '', '提交后回看已作答题应清空计时区');
  assert.equal(exports.timerState().interval, null, '提交停表后 interval 引用必须置空');
  exports.pauseExam();
  exports.resumeExam();
  assert.equal(timers.started.length, 1, '提交后暂停→继续不得重启计时器');
  assert.equal(submitted, 1, '不得触发重复提交');
});

test('入口一归零路径：自动提交回调停表后暂停→继续不重启、不重复提交', async () => {
  let submitted = 0;
  const api = {
    getCurrentQuestion: async () => answeredQuestionData(),
    submitAnswer: async () => { submitted += 1; },
    getExamProgress: async () => ({ total_count: 1, answers: [{ index: 0, is_correct: true }] }),
  };
  const { timers, exports, flushAsync } = loadTimerApp({ api });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  exports.startTimer(1);
  timers.fire(1); // 直接触发归零回调，模拟 1 秒后自动提交
  await flushAsync();
  assert.equal(submitted, 1);
  assert.equal(exports.timerState().interval, null, '归零停表后 interval 引用必须置空');
  exports.pauseExam();
  exports.resumeExam();
  assert.equal(timers.started.length, 1, '归零自动提交后暂停→继续不得重启计时器');
  assert.equal(submitted, 1, '不得触发第二次提交');
});

test('入口一边界：暂停期间切题请求完成不启动倒计时，恢复时再补启动', async () => {
  let resolveQuestion;
  const api = {
    getCurrentQuestion: () => new Promise((resolve) => { resolveQuestion = resolve; }),
  };
  const { timers, elements, exports } = loadTimerApp({ api });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  const loading = exports.loadQuestionByIndex(0);
  exports.pauseExam(); // 切题请求在途时暂停，模拟“上一题 + 立即暂停”的时序
  resolveQuestion({
    question: { id: 1, type: 'fill', content: '1+1=?', options: null, chapter: null, analysis: null, blank_count: 1 },
    is_answered: false,
    total_count: 1,
  });
  await loading;
  assert.equal(exports.timerState().paused, true);
  assert.equal(exports.timerState().interval, null, '暂停期间切题完成不得启动倒计时');
  assert.equal(exports.timerState().pending, true, '应挂起恢复时补启动的标记');
  exports.resumeExam();
  assert.equal(timers.started.length, 1, '恢复时应为新题启动一条全新倒计时');
  assert.equal(elements.get('exam-timer').textContent, '1:00', '填空题默认时长 60 秒');
});

test('入口一收尾路径：提前交卷停表后暂停→继续不重启计时器', async () => {
  const { timers, exports } = loadTimerApp({ api: { finishExam: async () => {} } });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  exports.startTimer(60);
  await exports.finishExam();
  assert.equal(exports.timerState().interval, null, '交卷停表后 interval 引用必须置空');
  exports.pauseExam();
  exports.resumeExam();
  assert.equal(timers.started.length, 1, '交卷后暂停→继续不得重启计时器');
});

test('收尾路径回归：暂停中交卷不再为停表重启一次倒计时', async () => {
  const { timers, exports } = loadTimerApp({ api: { finishExam: async () => {} } });
  exports.setExamContext({ examId: 42, totalCount: 1 });
  exports.startTimer(60);
  exports.pauseExam(); // pauseExam 已停表；旧实现 finishExam 会先 resume 重启一条再立即停掉
  await exports.finishExam();
  assert.equal(timers.started.length, 1, '暂停中交卷不得额外启动第二条 interval');
  assert.equal(exports.timerState().interval, null, '交卷后 interval 引用必须为 null');
});
