const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #115：整卷计时模式结束考试/提交最后一题时，前端上报页面计时器口径的
// 已用秒数（不含暂停时长），examElapsedSeconds 是该口径的唯一来源。
function loadExamElapsedSeconds() {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
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
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    api: {},
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}
__exports.examElapsedSeconds = examElapsedSeconds;
__exports.setTimerState = (s) => {
  examTimerMode = s.timerMode;
  examPaused = s.paused || false;
  examStartedAt = s.startedAt ?? null;
  examElapsedOffset = s.offset || 0;
};`, context);
  return context.__exports;
}

test('非整卷计时模式返回 null，不上报', () => {
  const { examElapsedSeconds, setTimerState } = loadExamElapsedSeconds();
  setTimerState({ timerMode: 'per_question', startedAt: new Date().toISOString(), offset: 30 });
  assert.equal(examElapsedSeconds(), null);
});

test('暂停中只返回暂停时保存的偏移量，不含暂停期间的墙钟时间', () => {
  const { examElapsedSeconds, setTimerState } = loadExamElapsedSeconds();
  // startedAt 在 10 分钟前，但已暂停，偏移量固定为 63s
  setTimerState({
    timerMode: 'elapsed', paused: true,
    startedAt: new Date(Date.now() - 600000).toISOString(), offset: 63,
  });
  assert.equal(examElapsedSeconds(), 63);
});

test('计时中返回 偏移量 + 恢复以来的秒数', () => {
  const { examElapsedSeconds, setTimerState } = loadExamElapsedSeconds();
  setTimerState({
    timerMode: 'elapsed',
    startedAt: new Date(Date.now() - 5000).toISOString(), offset: 10,
  });
  const v = examElapsedSeconds();
  assert.ok(v === 15 || v === 16, `期望 15±1，实际 ${v}`);
});

test('时钟偏斜导致 startedAt 在未来时不产生负数', () => {
  const { examElapsedSeconds, setTimerState } = loadExamElapsedSeconds();
  setTimerState({
    timerMode: 'elapsed',
    startedAt: new Date(Date.now() + 60000).toISOString(), offset: 7,
  });
  assert.equal(examElapsedSeconds(), 7);
});

test('未开始计时（startedAt 为空）时返回偏移量', () => {
  const { examElapsedSeconds, setTimerState } = loadExamElapsedSeconds();
  setTimerState({ timerMode: 'elapsed', startedAt: null, offset: 0 });
  assert.equal(examElapsedSeconds(), 0);
});
