const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadHelpers() {
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
      if (!this.elements.has(id)) this.elements.set(id, { textContent: '', style: {}, value: '1', max: '1', innerHTML: '' });
      return this.elements.get(id);
    },
  };
  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: documentStub,
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
__exports.filterRetryImportFiles = filterRetryImportFiles;`, context);
  return { ...context.__exports, sessionStorage: context.sessionStorage, document: context.document };
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
