// issue #161：数量滑杆上限只按题库总题数计算，不感知题型/章节筛选；
// 筛选后候选不足时后端静默取全部候选。开考返回的实际题数少于设定值时
// 必须明确提示，而不是无声缩水。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function runStartExam({ requested, actualTotal }) {
  const alerts = [];
  const byId = {
    'question-count-all': { checked: false },
    'question-count-input': { value: String(requested) },
    'timeout-choice': { value: '30' },
    'timeout-multi': { value: '45' },
    'timeout-fill': { value: '60' },
  };
  const context = {
    console,
    location: { hash: '#/exam/setup' },
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      addEventListener() {},
      getElementById(id) { return byId[id] || { value: '', checked: false, textContent: '', classList: { add() {}, remove() {} } }; },
      querySelector() { return null; },
      querySelectorAll(sel) {
        if (sel === '.bank-checkbox:checked') return [{ value: '1' }];
        if (sel === '.type-filter:checked') return [{ value: 'choice' }];
        return [];
      },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    alert: (m) => alerts.push(m),
    confirm: () => true,
    api: {
      getUnfinishedExams: async () => [],
      startExam: async () => ({
        exam_id: 9, total_count: actualTotal, timer_mode: 'per_question',
        started_at: '2026-07-27T00:00:00',
      }),
    },
    __exports: {},
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../../static/js/app.js'), 'utf8');
  vm.runInContext(`${source}\n__exports.startExam = startExam;`, context);
  return context.__exports.startExam().then(() => ({ alerts, context }));
}

test('筛选后实际题数少于设定值时给出明确提示', async () => {
  const { alerts, context } = await runStartExam({ requested: 50, actualTotal: 20 });
  assert.equal(alerts.length, 1, '应有且仅有一次提示');
  assert.match(alerts[0], /20/, '提示应包含实际题数');
  assert.match(alerts[0], /50/, '提示应包含设定题数');
  assert.equal(context.location.hash, '/exam', '提示后仍正常进入考试');
});

test('实际题数等于设定值时不打扰用户', async () => {
  const { alerts, context } = await runStartExam({ requested: 20, actualTotal: 20 });
  assert.deepEqual(alerts, []);
  assert.equal(context.location.hash, '/exam');
});
