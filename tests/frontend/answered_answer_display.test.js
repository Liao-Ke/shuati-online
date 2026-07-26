const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #111：后端 /current 对已作答题目返回真实数组后，
// parseAnswerArray 直接透传数组用于选项高亮，formatAnswerText 渲染可读文案。
function loadHelpers() {
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
__exports.parseAnswerArray = parseAnswerArray;
__exports.formatAnswerText = formatAnswerText;`, context);
  return context.__exports;
}

test('parseAnswerArray 直接透传数组', () => {
  const { parseAnswerArray } = loadHelpers();
  assert.deepEqual([...parseAnswerArray(['A', 'B'])], ['A', 'B']);
});

test('parseAnswerArray 将字符串包装为单元素数组', () => {
  const { parseAnswerArray } = loadHelpers();
  assert.deepEqual([...parseAnswerArray('B')], ['B']);
  assert.deepEqual([...parseAnswerArray(null)], []);
});

test('parseAnswerArray 不再破坏含英文单引号的答案文本', () => {
  const { parseAnswerArray } = loadHelpers();
  assert.deepEqual([...parseAnswerArray(["don't", 'stop'])], ["don't", 'stop']);
});

test('formatAnswerText 数组渲染为逗号分隔可读格式', () => {
  const { formatAnswerText } = loadHelpers();
  assert.equal(formatAnswerText(['A', 'B']), 'A, B');
  assert.equal(formatAnswerText(['造纸术', '印刷术', '火药', '指南针']), '造纸术, 印刷术, 火药, 指南针');
});

test('formatAnswerText 字符串与空值原样返回', () => {
  const { formatAnswerText } = loadHelpers();
  assert.equal(formatAnswerText('B'), 'B');
  assert.equal(formatAnswerText(null), null);
});
