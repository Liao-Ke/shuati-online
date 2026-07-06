const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadHelpers() {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const storage = new Map();
  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } },
    sessionStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n__exports.saveExamTimeouts = saveExamTimeouts;\n__exports.getExamTimeoutSeconds = getExamTimeoutSeconds;`, context);
  return { ...context.__exports, sessionStorage: context.sessionStorage };
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
