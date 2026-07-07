const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeElement(tagName = 'div') {
  const classes = new Set();
  return {
    tagName,
    children: [],
    className: '',
    textContent: '',
    value: '',
    type: '',
    checked: false,
    style: {},
    appendChild(child) { this.children.push(child); return child; },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
    },
    querySelector() { return null; },
  };
}

function loadChapterRenderers() {
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  const elements = new Map();
  const documentStub = {
    createElement: makeElement,
    createTextNode(text) { return { nodeType: 3, textContent: text }; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll(selector) {
      const targetClass = selector.includes('review-chapter-filter') ? 'review-chapter-filter' : 'exam-chapter-filter';
      const roots = [...elements.values()];
      const inputs = [];
      const walk = (node) => {
        if (!node || !node.children) return;
        if (node.className && node.className.split(/\s+/).includes(targetClass)) inputs.push(node);
        node.children.forEach(walk);
      };
      roots.forEach(walk);
      return selector.endsWith(':checked') ? inputs.filter(input => input.checked) : inputs;
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement('div'));
      return elements.get(id);
    },
  };
  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: documentStub,
    api: {},
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    __exports: {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n__exports.renderChapterCheckboxes = renderChapterCheckboxes;\n__exports.renderExamChapterCheckboxes = renderExamChapterCheckboxes;`, context);
  return { ...context.__exports, document: documentStub };
}

test('chapter filter renderers preserve quoted chapter names in checkbox values', () => {
  const { renderChapterCheckboxes, renderExamChapterCheckboxes, document } = loadChapterRenderers();
  const chapter = '第"一"章';

  renderChapterCheckboxes([chapter]);
  renderExamChapterCheckboxes([chapter]);

  const reviewLabel = document.getElementById('review-chapter-list').children[0];
  const examLabel = document.getElementById('exam-chapter-list').children[0];

  assert.equal(reviewLabel.children[0].value, chapter);
  assert.equal(reviewLabel.children[1].textContent, ` ${chapter}`);
  assert.equal(examLabel.children[0].value, chapter);
  assert.equal(examLabel.children[1].textContent, ` ${chapter}`);
});
