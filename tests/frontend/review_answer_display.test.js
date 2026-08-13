// issue #159：背题模式题卡「答案」直接输出 DB 原文，多选/多空填空显示为
// ["A", "B"] JSON 字符串。应转成 "A, B"，与结果页 formatAnswerText 口径一致。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function renderReview(questions) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        classList: { add() {}, remove() {} },
        addEventListener() {},
      });
    }
    return elements.get(id);
  };
  const context = {
    console,
    location: { hash: '#/review' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      // escHtml 依赖 div.textContent → div.innerHTML 的 DOM 转义，stub 需真实实现
      createElement() {
        return {
          _text: '',
          set textContent(v) { this._text = String(v); },
          get textContent() { return this._text; },
          get innerHTML() {
            return this._text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          },
          set innerHTML(v) { this._text = v; },
          classList: { add() {}, remove() {} },
          addEventListener() {},
        };
      },
      getElementById(id) { return element(id); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: {},
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
reviewQuestions = ${JSON.stringify(questions)};
renderReviewPage();`, context);
  return elements.get('content').innerHTML;
}

test('背题模式多选题答案显示为 A, B 而非 JSON 原文', () => {
  const html = renderReview([{
    id: 1, type: 'multiple', content: '哪些是数字？',
    options: '["一", "二"]', answer: '["A", "B"]', review_status: null,
  }]);
  assert.match(html, /答案：<\/strong>A, B/);
  assert.doesNotMatch(html, /答案：<\/strong>\[/);
});

test('背题模式多空填空答案显示为逗号分隔而非 JSON 原文', () => {
  const html = renderReview([{
    id: 2, type: 'fill', content: '四大发明____和____',
    options: null, answer: '["造纸术", "印刷术"]', review_status: 'known',
  }]);
  assert.match(html, /答案：<\/strong>造纸术, 印刷术/);
});

test('单空填空/判断/选择题答案原样展示不受影响', () => {
  const html = renderReview([
    { id: 3, type: 'fill', content: '首都____', options: null, answer: '北京', review_status: null },
    { id: 4, type: 'judge', content: '地球是圆的', options: null, answer: '对', review_status: null },
    { id: 5, type: 'choice', content: '1+1', options: '["1", "2"]', answer: 'B', review_status: null },
  ]);
  assert.match(html, /答案：<\/strong>北京/);
  assert.match(html, /答案：<\/strong>对/);
  assert.match(html, /答案：<\/strong>B/);
});
