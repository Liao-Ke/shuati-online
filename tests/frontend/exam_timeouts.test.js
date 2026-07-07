const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadHelpers(overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const storage = new Map();
  const documentStub = {
    elements: new Map(),
    queryResults: new Map(),
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll(selector) {
      const results = this.queryResults.get(selector) || [];
      if (selector.endsWith(':checked')) return results.filter(el => el.checked);
      if (selector.includes('.selected')) return results.filter(el => el.classList?.contains('selected'));
      return results;
    },
    getElementById(id) {
      if (!this.elements.has(id)) {
        const classes = new Set();
        this.elements.set(id, {
          textContent: '',
          style: {},
          value: '1',
          max: '1',
          innerHTML: '',
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
  const removedListeners = [];
  const context = {
    console,
    location: { hash: '' },
    window: {
      addEventListener() {},
      removeEventListener(event, handler) { removedListeners.push({ event, handler }); },
    },
    clearInterval() {},
    clearTimeout() {},
    document: documentStub,
    api: overrides.api || {},
    sessionStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n__exports.saveExamTimeouts = saveExamTimeouts;\n__exports.getExamTimeoutSeconds = getExamTimeoutSeconds;
__exports.formatBankDisplayName = formatBankDisplayName;
__exports.isWrongPracticeBankChecked = isWrongPracticeBankChecked;
__exports.toggleBankSelect = toggleBankSelect;
__exports.toggleReviewBankSelect = toggleReviewBankSelect;
__exports.filterRetryImportFiles = filterRetryImportFiles;
__exports.resetSessionState = resetSessionState;
__exports.primeSessionState = () => {
  examId = 42;
  examTotalCount = 3;
  selectedAnswer = 'A';
  selectedMultiAnswers = ['A', 'B'];
  examTimerInterval = 1;
  examElapsedInterval = 2;
  examScrollTimer = 3;
  examTimeoutSeconds = 99;
  examCurrentIndex = 2;
  examProgress = { current: 2 };
  examPaused = true;
  examPauseRemaining = 8;
  examFullPreview = true;
  examTimerMode = 'elapsed';
  examStartedAt = '2026-01-01T00:00:00.000Z';
  examElapsedOffset = 12;
  reviewFilter = { status: 'reviewing' };
  reviewQuestions = [{ id: 1 }];
  state.questionStartTime = 123;
};
__exports.snapshotSessionState = () => ({
  examId,
  examTotalCount,
  selectedAnswer,
  selectedMultiAnswers,
  examTimerInterval,
  examElapsedInterval,
  examScrollTimer,
  examTimeoutSeconds,
  examCurrentIndex,
  examProgress,
  examPaused,
  examPauseRemaining,
  examFullPreview,
  examTimerMode,
  examStartedAt,
  examElapsedOffset,
  reviewFilter,
  reviewQuestions,
  questionStartTime: state.questionStartTime,
});
__exports.router = router;`, context);
  return { ...context.__exports, sessionStorage: context.sessionStorage, document: context.document, removedListeners };
}

function makeCard(selector, checked = false, questionCount = '3') {
  const cb = { checked, value: '1' };
  const classes = new Set();
  const card = {
    dataset: { questionCount },
    querySelector(query) { return query === selector ? cb : null; },
    classList: {
      toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
  return { card, cb };
}

test('exam timeout helpers persist and read custom per-question durations', () => {
  const { saveExamTimeouts, getExamTimeoutSeconds, sessionStorage } = loadHelpers();

  saveExamTimeouts(120, 90, 100);

  assert.deepEqual(JSON.parse(sessionStorage.getItem('examTimeouts')), { choice: 120, multi: 90, fill: 100 });
  assert.equal(getExamTimeoutSeconds('choice'), 120);
  assert.equal(getExamTimeoutSeconds('multiple'), 90);
  assert.equal(getExamTimeoutSeconds('fill'), 100);
  assert.equal(getExamTimeoutSeconds('judge'), 100);
});

test('exam timeout helpers fall back to defaults when storage is missing or broken', () => {
  const { getExamTimeoutSeconds, sessionStorage } = loadHelpers();

  assert.equal(getExamTimeoutSeconds('choice'), 30);
  assert.equal(getExamTimeoutSeconds('multiple'), 45);
  assert.equal(getExamTimeoutSeconds('fill'), 60);

  sessionStorage.setItem('examTimeouts', '{broken json');

  assert.equal(getExamTimeoutSeconds('choice'), 30);
  assert.equal(getExamTimeoutSeconds('multiple'), 45);
  assert.equal(getExamTimeoutSeconds('judge'), 60);
});

test('reset session state clears exam and review browser state', () => {
  const { resetSessionState, primeSessionState, snapshotSessionState, sessionStorage, removedListeners } = loadHelpers();
  const keys = ['activeExamId', 'examCurrentIndex', 'examMode', 'examTimerMode', 'examStartedAt', 'examElapsedOffset', 'examTimeouts', 'reviewFilter'];
  keys.forEach((key) => sessionStorage.setItem(key, `stale-${key}`));

  primeSessionState();
  resetSessionState();

  keys.forEach((key) => assert.equal(sessionStorage.getItem(key), null, `${key} should be cleared`));
  assert.equal(removedListeners.some(({ event }) => event === 'scroll'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshotSessionState())), {
    examId: null,
    examTotalCount: 0,
    selectedAnswer: null,
    selectedMultiAnswers: [],
    examTimerInterval: null,
    examElapsedInterval: null,
    examScrollTimer: null,
    examTimeoutSeconds: 30,
    examCurrentIndex: 0,
    examProgress: null,
    examPaused: false,
    examPauseRemaining: 0,
    examFullPreview: false,
    examTimerMode: 'per_question',
    examStartedAt: null,
    examElapsedOffset: 0,
    reviewFilter: null,
    reviewQuestions: [],
    questionStartTime: null,
  });
});


test('wrong answer bank helpers distinguish same-title banks by id', () => {
  const { formatBankDisplayName, isWrongPracticeBankChecked } = loadHelpers();
  const wrongBankIds = new Set([101]);
  const first = { id: 101, title: '同名题库' };
  const second = { id: 202, title: '同名题库' };

  assert.equal(formatBankDisplayName(first.title, first.id), '同名题库 #101');
  assert.equal(formatBankDisplayName(second.title, second.id), '同名题库 #202');
  assert.equal(isWrongPracticeBankChecked(first, wrongBankIds), true);
  assert.equal(isWrongPracticeBankChecked(second, wrongBankIds), false);
});


test('bank card selection stays in sync when clicking checkbox or card body', () => {
  const { toggleBankSelect, document } = loadHelpers();
  const { card, cb } = makeCard('.bank-checkbox', true);

  document.queryResults.set('.bank-checkbox:checked', [cb]);
  document.queryResults.set('.bank-check-card.selected', [card]);

  toggleBankSelect(card, { target: cb });

  assert.equal(cb.checked, true);
  assert.equal(card.classList.contains('selected'), true);
  assert.equal(document.getElementById('selected-count').textContent, '已选 1 个题库');

  toggleBankSelect(card, { target: card });

  assert.equal(cb.checked, false);
  assert.equal(card.classList.contains('selected'), false);
  assert.equal(document.getElementById('selected-count').textContent, '已选 0 个题库');
});

test('review bank card selection stays in sync when clicking checkbox or card body', () => {
  const { toggleReviewBankSelect, document } = loadHelpers();
  const { card, cb } = makeCard('.review-bank-checkbox', true);

  document.queryResults.set('.review-bank-checkbox:checked', [cb]);

  toggleReviewBankSelect(card, { target: cb });

  assert.equal(cb.checked, true);
  assert.equal(card.classList.contains('selected'), true);
  assert.equal(document.getElementById('review-selected-count').textContent, '已选 1 个题库');

  toggleReviewBankSelect(card, { target: card });

  assert.equal(cb.checked, false);
  assert.equal(card.classList.contains('selected'), false);
  assert.equal(document.getElementById('review-selected-count').textContent, '已选 0 个题库');
});


test('batch import retry keeps only failed or unknown-result items', () => {
  const { filterRetryImportFiles } = loadHelpers();
  const validA = { title: '合法题库 A' };
  const invalidB = { title: '失败题库 B' };
  const unknownC = { title: '未知结果题库 C' };

  assert.deepEqual(
    filterRetryImportFiles([validA, invalidB, unknownC], [{ success: true }, { success: false }]),
    [invalidB, unknownC],
  );
});


test('unfinished result page keeps exam session state and offers continue action', async () => {
  const { router, sessionStorage, document } = loadHelpers({
    api: {
      async getExamResult() {
        const err = new Error('考试尚未完成');
        err.status = 409;
        throw err;
      },
    },
  });
  sessionStorage.setItem('activeExamId', '42');
  sessionStorage.setItem('examCurrentIndex', '2');
  sessionStorage.setItem('examMode', 'sequential');

  await router.routes['/result/:id'].handler({ id: '42' });

  assert.equal(sessionStorage.getItem('activeExamId'), '42');
  assert.equal(sessionStorage.getItem('examCurrentIndex'), '2');
  const html = document.getElementById('content').innerHTML;
  assert.match(html, /考试尚未完成/);
  assert.match(html, /#\/exam/);
});

test('finished result page clears exam session state after result loads', async () => {
  const result = {
    exam_id: 42,
    accuracy: 1,
    correct_count: 1,
    wrong_count: 0,
    duration_seconds: 8,
    answers: [],
  };
  const { router, sessionStorage } = loadHelpers({
    api: { async getExamResult() { return result; } },
  });
  ['activeExamId', 'examCurrentIndex', 'examMode', 'examTimerMode', 'examStartedAt', 'examTimeouts'].forEach((key) => {
    sessionStorage.setItem(key, 'kept-before-result');
  });

  await router.routes['/result/:id'].handler({ id: '42' });

  ['activeExamId', 'examCurrentIndex', 'examMode', 'examTimerMode', 'examStartedAt', 'examTimeouts'].forEach((key) => {
    assert.equal(sessionStorage.getItem(key), null, `${key} should be cleared after successful result load`);
  });
});
