const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// issue #113：整卷模式渲染选择题时，已作答题的选项不应绑定 submitInlineChoice，
// 否则点击会触发重复提交请求并弹出错误 alert。
function loadRenderFullPreview(previewData) {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const documentStub = {
    elements: new Map(),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    // escHtml 依赖 createElement 做 HTML 转义，这里模拟 textContent → innerHTML 的转义行为
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
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} },
    setTimeout() {},
    clearInterval() {},
    clearTimeout() {},
    document: documentStub,
    api: {
      getExamPreview: async () => previewData,
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}
__exports.render = async () => {
  examId = 7;
  await renderFullPreview();
  return document.getElementById('exam-content').innerHTML;
};`, context);
  return context.__exports;
}

test('answered choice options carry no click handler in full preview (issue #113)', async () => {
  const { render } = loadRenderFullPreview({
    total_count: 2,
    questions: [
      { id: 11, index: 0, type: 'choice', content: '已作答题', options: ['甲', '乙'], is_answered: true, is_correct: false, answer: 'A', user_answer: 'B', analysis: '', chapter: null },
      { id: 12, index: 1, type: 'choice', content: '未作答题', options: ['甲', '乙'], is_answered: false, answer: 'A', user_answer: null, analysis: '', chapter: null },
    ],
  });
  const html = await render();
  const [answeredCard, unansweredCard] = html.split('data-index="1"');
  assert.ok(!answeredCard.includes('submitInlineChoice'), '已作答选择题选项不应绑定 submitInlineChoice');
  assert.ok(!answeredCard.includes('cursor:pointer'), '已作答选择题选项不应显示 pointer 光标');
  assert.ok(unansweredCard.includes(`onclick="submitInlineChoice(7, 12, 1, 'A')"`), '未作答选择题选项应保留点击提交');
  assert.ok(unansweredCard.includes('cursor:pointer'), '未作答选择题选项应显示 pointer 光标');
});
