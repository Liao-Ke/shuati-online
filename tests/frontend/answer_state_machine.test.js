// issue #150：submitCurrentAnswer 依赖模块级 selectedAnswer/selectedMultiAnswers。
// 路径一：切题只做单向重置，旧题未提交的多选残留覆盖新题答案（或反向）→ 400。
// 路径二：组装时就清空 selectedMultiAnswers，提交失败后重试拿到 null → 静默判错。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const QUESTIONS = [
  { id: 11, type: 'multiple', chapter: null, content: '多选题', options: '["甲","乙","丙"]', analysis: null },
  { id: 12, type: 'choice', chapter: null, content: '单选题', options: '["1","2","3"]', analysis: null },
];

function loadExamApp({ submitImpls }) {
  const submitted = [];
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: '', textContent: '', style: {}, value: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {},
        querySelectorAll() { return []; },
        querySelector() { return null; },
      });
    }
    return elements.get(id);
  };
  const context = {
    console,
    location: { hash: '#/exam' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement() { return element(`__el${elements.size}`); },
      getElementById(id) { return element(id); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout, clearTimeout, Date,
    alert() {},
    api: {
      getCurrentQuestion: async (examId, index) => ({
        question: QUESTIONS[index], total_count: 2, is_answered: false,
      }),
      submitAnswer: async (examId, qid, userAnswer) => {
        const impl = submitImpls.shift();
        if (impl === 'fail') throw new TypeError('Failed to fetch');
        submitted.push({ qid, userAnswer });
        return { is_correct: true, next_index: null, is_last: false };
      },
      getExamProgress: async () => ({ answers: [], total_count: 2 }),
    },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}
examId = 1; examTotalCount = 2;
__exports.loadQuestionByIndex = loadQuestionByIndex;
__exports.selectChoice = selectChoice;
__exports.toggleMultiChoice = toggleMultiChoice;
__exports.submitCurrentAnswer = submitCurrentAnswer;`, context);
  const el = () => element('__probe');
  return { submitted, exports: context.__exports, el };
}

test('路径一：多选未提交切到选择题，提交的是新题的字符串答案', async () => {
  const { submitted, exports, el } = loadExamApp({ submitImpls: [] });
  await exports.loadQuestionByIndex(0);
  exports.toggleMultiChoice(el(), 'A');
  exports.toggleMultiChoice(el(), 'B');
  await exports.loadQuestionByIndex(1);
  exports.selectChoice(el(), 'C');
  await exports.submitCurrentAnswer();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].qid, 12);
  assert.equal(submitted[0].userAnswer, 'C', '旧题的多选残留不得覆盖新题答案');
});

test('路径一反向：选择题未提交切到多选题，倒计时归零自动提交的是 null 而非残留字符串', async () => {
  const { submitted, exports, el } = loadExamApp({ submitImpls: [] });
  await exports.loadQuestionByIndex(1);
  exports.selectChoice(el(), 'B');
  await exports.loadQuestionByIndex(0);
  // 多选题未勾选任何项，模拟倒计时归零自动提交
  await exports.submitCurrentAnswer();
  assert.equal(submitted[0].qid, 11);
  assert.equal(submitted[0].userAnswer, null, '旧题的选择残留字符串不得被提交到多选题');
});

test('路径二：多选提交失败后重试，提交内容与首次一致而非 null', async () => {
  const { submitted, exports, el } = loadExamApp({ submitImpls: ['fail'] });
  await exports.loadQuestionByIndex(0);
  exports.toggleMultiChoice(el(), 'A');
  exports.toggleMultiChoice(el(), 'B');
  await exports.submitCurrentAnswer();   // 网络失败
  assert.equal(submitted.length, 0);
  await exports.submitCurrentAnswer();   // 重试
  assert.equal(submitted.length, 1);
  assert.equal(JSON.stringify(submitted[0].userAnswer), '["A","B"]', '失败重试不得丢答案提交 null');
});
