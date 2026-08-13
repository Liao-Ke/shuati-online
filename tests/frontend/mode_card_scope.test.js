// issue #152：答题模式与计时方式两组卡片同为 .mode-card。selectMode 按类名
// 全清 active 会把用户选好的「整卷计时」静默重置回单题计时。应与
// selectTimerMode 同口径用 data 属性限定作用域。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function fakeCard(attrs) {
  const classes = new Set(attrs.classes || []);
  return {
    dataset: attrs.dataset || {},
    _attrs: attrs,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
  };
}

test('selectMode 只清答题模式组的 active，计时方式选择保留', () => {
  const sequential = fakeCard({ dataset: { mode: 'sequential' }, classes: ['mode-card'] });
  const random = fakeCard({ dataset: { mode: 'random' }, classes: ['mode-card', 'active'] });
  const perQuestion = fakeCard({ dataset: { timer: 'per_question' }, classes: ['mode-card'] });
  const elapsed = fakeCard({ dataset: { timer: 'elapsed' }, classes: ['mode-card', 'active'] });
  const all = [sequential, random, perQuestion, elapsed];

  const context = {
    console,
    location: { hash: '' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll(sel) {
        if (sel === '[data-mode]') return all.filter(c => 'mode' in c.dataset);
        if (sel === '[data-timer]') return all.filter(c => 'timer' in c.dataset);
        if (sel === '.mode-card') return all;
        return [];
      },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    api: {},
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.selectMode = selectMode;`, context);

  // 用户已选「整卷计时」（elapsed active），再点「顺序模式」
  context.__exports.selectMode(sequential);

  assert.ok(sequential.classList.contains('active'), '被点击的答题模式卡应高亮');
  assert.ok(!random.classList.contains('active'), '同组其他答题模式卡应取消高亮');
  assert.ok(elapsed.classList.contains('active'), '整卷计时的选择不应被清掉');
  assert.ok(!perQuestion.classList.contains('active'), '单题计时保持未选中');
});
