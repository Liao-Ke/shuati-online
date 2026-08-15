const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #82：未作答填空题 answer 被隐藏，前端改用后端安全元数据 blank_count
// 渲染对应数量的输入框（单题模式 loadQuestionByIndex / 整卷预览 renderFullPreview）。
function loadRenderers() {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const documentStub = {
    elements: new Map(),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    // escHtml 依赖 createElement 做 HTML 转义，模拟 textContent → innerHTML 的转义行为
    createElement() {
      let text = '';
      return {
        set textContent(v) { text = String(v); },
        get innerHTML() { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
      };
    },
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
    // loadQuestionByIndex 会丢弃“不在 /exam 路由”的过期响应（issue #151 入口二），
    // 渲染类测试必须模拟真实考试页上下文
    location: { hash: '#/exam' },
    window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} },
    setTimeout() {},
    clearTimeout() {},
    clearInterval() {},
    document: documentStub,
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: {},
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}
renderQuestionGrid = () => {};
updateNavButtons = () => {};
examId = 42;
examTimerMode = 'elapsed';
__exports.renderSingle = async (q) => {
  api.getCurrentQuestion = async () => ({ exam_id: 42, total_count: 1, question: q, is_answered: false });
  await loadQuestionByIndex(0);
  return document.getElementById('exam-content').innerHTML;
};
__exports.renderPreview = async (q) => {
  api.getExamPreview = async () => ({ total_count: 1, questions: [q] });
  await renderFullPreview();
  return document.getElementById('exam-content').innerHTML;
};`, context);
  return context.__exports;
}

const count = (html, needle) => html.split(needle).length - 1;

test('单题模式：多空填空按 blank_count 渲染多个输入框', async () => {
  const { renderSingle } = loadRenderers();
  const html = await renderSingle({
    id: 7, type: 'fill', chapter: null, content: '四大发明是____、____、____和____',
    options: null, answer: null, analysis: null, sort_order: 0, blank_count: 4,
  });
  assert.equal(count(html, 'fill-input'), 4, `应渲染 4 个空位输入框: ${html}`);
  assert.ok(!html.includes('id="fill-answer"'), '不应渲染单空输入框');
});

test('单题模式：单空填空仍渲染单个输入框', async () => {
  const { renderSingle } = loadRenderers();
  const html = await renderSingle({
    id: 8, type: 'fill', chapter: null, content: '中国的首都是____',
    options: null, answer: null, analysis: null, sort_order: 1, blank_count: 1,
  });
  assert.ok(html.includes('id="fill-answer"'), `应渲染单空输入框: ${html}`);
  assert.equal(count(html, 'class="form-control fill-input"'), 0);
});

test('整卷预览：未作答多空填空按 blank_count 渲染多个输入框', async () => {
  const { renderPreview } = loadRenderers();
  const html = await renderPreview({
    index: 0, id: 7, type: 'fill', chapter: null, content: '四大发明是____、____、____和____',
    options: null, answer: null, analysis: null, user_answer: null,
    is_answered: false, is_correct: null, blank_count: 4,
  });
  assert.equal(count(html, 'preview-fill-input'), 4, `应渲染 4 个空位输入框: ${html}`);
});

test('整卷预览：blank_count 缺省回退单输入框', async () => {
  const { renderPreview } = loadRenderers();
  const html = await renderPreview({
    index: 0, id: 8, type: 'fill', chapter: null, content: '中国的首都是____',
    options: null, answer: null, analysis: null, user_answer: null,
    is_answered: false, is_correct: null, blank_count: null,
  });
  assert.equal(count(html, 'preview-fill-input'), 1, `应渲染 1 个输入框: ${html}`);
});
