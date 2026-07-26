const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #81：题目删除后历史详情回退快照展示，renderAnswerReviewItem
// 需渲染「题目已删除」徽标；无快照的旧孤儿记录隐藏正确答案行。
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
      // escHtml 依赖 createElement 的 textContent → innerHTML 转义行为
      createElement() {
        return {
          set textContent(v) { this._t = v; },
          get innerHTML() {
            return String(this._t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          },
        };
      },
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
__exports.renderAnswerReviewItem = renderAnswerReviewItem;`, context);
  return context.__exports;
}

test('现存题目：无删除徽标，正常显示正确答案', () => {
  const { renderAnswerReviewItem } = loadHelpers();
  const html = renderAnswerReviewItem({
    type: 'choice', content: '1+1=?', options: ['1', '2'],
    correct_answer: 'B', user_answer: 'A', is_correct: false, time_spent: 3,
  }, 0);
  assert.ok(!html.includes('题目已删除'));
  assert.ok(html.includes('正确答案: B'));
  assert.ok(html.includes('1+1=?'));
});

test('已删除题目（有快照）：显示徽标且明细完整', () => {
  const { renderAnswerReviewItem } = loadHelpers();
  const html = renderAnswerReviewItem({
    type: 'choice', content: '快照题干', options: ['甲', '乙'],
    correct_answer: 'B', user_answer: 'A', is_correct: false, time_spent: 3,
    analysis: '解析文本', question_deleted: true,
  }, 1);
  assert.ok(html.includes('题目已删除'));
  assert.ok(html.includes('快照题干'));
  assert.ok(html.includes('正确答案: B'));
  assert.ok(html.includes('解析: 解析文本'));
});

test('无快照孤儿记录：隐藏正确答案与解析行，保留用户答案', () => {
  const { renderAnswerReviewItem } = loadHelpers();
  const html = renderAnswerReviewItem({
    type: null, content: '（题目已删除，仅保留作答记录）', options: null,
    correct_answer: null, user_answer: '对', is_correct: true, time_spent: 3,
    analysis: null, question_deleted: true,
  }, 2);
  assert.ok(html.includes('题目已删除'));
  assert.ok(!html.includes('正确答案'));
  assert.ok(!html.includes('解析:'));
  assert.ok(html.includes('你的答案: 对'));
});
