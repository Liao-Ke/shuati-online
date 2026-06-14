class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.resolve());
  }

  add(path, handler) {
    const pattern = path.replace(/:([^/]+)/g, '(?<$1>[^/]+)');
    this.routes[path] = { pattern: new RegExp(`^${pattern}$`), handler };
  }

  resolve() {
    const hash = location.hash.replace(/^#/, '') || '/login';
    for (const [, route] of Object.entries(this.routes)) {
      const match = hash.match(route.pattern);
      if (match) {
        route.handler(match.groups || {});
        return;
      }
    }
    document.getElementById('content').innerHTML = '<h2 class="mt-5 text-center">404 - 页面未找到</h2>';
  }

  navigate(path) {
    location.hash = path;
  }
}

const state = {
  user: null,
  timerInterval: null,
  questionStartTime: null,
};

const router = new Router();
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let examId = null;
let examTotalCount = 0;
let selectedAnswer = null;
let examTimerInterval = null;
let examTimeoutSeconds = 30;

async function checkAuth() {
  if (!api.token) return false;
  try {
    state.user = await api.me();
    return true;
  } catch {
    api.setToken(null);
    return false;
  }
}

router.add('/login', async () => {
  render(`
    <div class="auth-page">
      <div class="auth-card">
        <h1 class="auth-logo">刷题在线</h1>
        <p class="text-muted mb-4">登录你的账号</p>
        <div id="auth-error" class="alert alert-danger d-none"></div>
        <form id="login-form">
          <div class="mb-3">
            <label class="form-label">用户名</label>
            <input type="text" class="form-control" id="login-username" required autocomplete="username">
          </div>
          <div class="mb-3">
            <label class="form-label">密码</label>
            <input type="password" class="form-control" id="login-password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary w-100 btn-lg">登 录</button>
        </form>
        <p class="text-center mt-3 mb-0">
          还没有账号？<a href="#/register">去注册</a>
        </p>
      </div>
    </div>
  `);
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '登录中...';
    try {
      const res = await api.login(username, password);
      api.setToken(res.access_token);
      state.user = res.user;
      router.navigate('/dashboard');
    } catch (err) {
      const errDiv = document.getElementById('auth-error');
      errDiv.textContent = err.message;
      errDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false; btn.innerHTML = '登 录';
    }
  });
});

router.add('/register', () => {
  render(`
    <div class="auth-page">
      <div class="auth-card">
        <h1 class="auth-logo">刷题在线</h1>
        <p class="text-muted mb-4">创建新账号</p>
        <div id="auth-error" class="alert alert-danger d-none"></div>
        <form id="register-form">
          <div class="mb-3">
            <label class="form-label">用户名</label>
            <input type="text" class="form-control" id="reg-username" required autocomplete="username">
          </div>
          <div class="mb-3">
            <label class="form-label">密码</label>
            <input type="password" class="form-control" id="reg-password" required minlength="6" autocomplete="new-password">
          </div>
          <div class="mb-3">
            <label class="form-label">确认密码</label>
            <input type="password" class="form-control" id="reg-confirm" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn btn-primary w-100 btn-lg">注 册</button>
        </form>
        <p class="text-center mt-3 mb-0">
          已有账号？<a href="#/login">去登录</a>
        </p>
      </div>
    </div>
  `);
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    if (password !== confirm) {
      document.getElementById('auth-error').textContent = '两次密码不一致';
      document.getElementById('auth-error').classList.remove('d-none');
      return;
    }
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '注册中...';
    try {
      const res = await api.register(username, password);
      api.setToken(res.access_token);
      state.user = res.user;
      router.navigate('/dashboard');
    } catch (err) {
      const errDiv = document.getElementById('auth-error');
      errDiv.textContent = err.message;
      errDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false; btn.innerHTML = '注 册';
    }
  });
});

router.add('/dashboard', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const data = await api.getDashboard();
    render(`
      <div class="page-header">
        <h2>欢迎回来，${escHtml(state.user.username)}</h2>
        <a href="#/exam/setup" class="btn btn-primary btn-lg">开始刷题</a>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_banks}</div><div class="stat-label">题库数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_questions}</div><div class="stat-label">总题数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_exams}</div><div class="stat-label">练习次数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${(data.average_accuracy * 100).toFixed(0)}%</div><div class="stat-label">正确率</div></div>
        </div>
      </div>
      <h3 class="mb-3">最近练习</h3>
      <div id="recent-exams"></div>
    `);
    const list = document.getElementById('recent-exams');
    if (data.recent_exams.length === 0) {
      list.innerHTML = '<p class="text-muted">还没有练习记录</p>';
    } else {
      data.recent_exams.forEach(ex => {
        const date = new Date(ex.started_at).toLocaleString('zh-CN');
        const acc = (ex.accuracy * 100).toFixed(0);
        list.innerHTML += `
          <div class="history-item" onclick="router.navigate('/history/${ex.id}')">
            <div class="d-flex justify-content-between align-items-center">
              <div><strong>${date}</strong> · ${ex.mode === 'random' ? '随机' : '顺序'}模式</div>
              <div><span class="badge bg-success">${ex.correct_count}/${ex.question_count}</span> ${acc}%</div>
            </div>
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/banks', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const banks = await api.getBanks();
    render(`
      <div class="page-header">
        <h2>题库管理</h2>
        <div>
          <button class="btn btn-outline-primary me-2" onclick="showImportModal()">导入题库</button>
          <button class="btn btn-outline-secondary" onclick="downloadSample()">下载示例 JSON</button>
        </div>
      </div>
      ${banks.length === 0 ? '<div class="empty-state"><p>还没有题库</p><p class="text-muted">点击"导入题库"开始</p></div>' : ''}
      <div class="row g-3" id="bank-list"></div>
      <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">导入题库</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">选择 JSON 文件（支持多选）</label>
              <input type="file" class="form-control" id="import-file" accept=".json" multiple>
            </div>
            <div id="import-preview"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button class="btn btn-primary" id="import-btn" disabled onclick="doImport()">确认导入</button>
          </div>
        </div></div>
      </div>
    `);
    const list = document.getElementById('bank-list');
    banks.forEach(b => {
      list.innerHTML += `
        <div class="col-md-6 col-lg-4">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">${escHtml(b.title)}</h5>
              <p class="card-text text-muted">${b.question_count} 题 · ${b.description ? escHtml(b.description) : ''}</p>
              <p class="card-text"><small class="text-muted">更新于 ${new Date(b.updated_at).toLocaleDateString('zh-CN')}</small></p>
              <a href="#/banks/${b.id}" class="btn btn-outline-primary btn-sm">详情</a>
              <button class="btn btn-outline-danger btn-sm ms-1" onclick="confirmDeleteBank(${b.id}, '${escHtml(b.title)}')">删除</button>
            </div>
          </div>
        </div>
      `;
    });
    document.getElementById('import-file').addEventListener('change', previewImport);
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/banks/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const bank = await api.getBank(id);
    render(`
      <div class="page-header">
        <h2><a href="#/banks" class="text-decoration-none me-2">&larr;</a> ${escHtml(bank.title)}</h2>
        <p class="text-muted">共 ${bank.question_count} 题</p>
      </div>
      <div id="questions-by-chapter"></div>
    `);
    const chapters = {};
    bank.questions.forEach(q => {
      const ch = q.chapter || '未分类';
      if (!chapters[ch]) chapters[ch] = [];
      chapters[ch].push(q);
    });
    const container = document.getElementById('questions-by-chapter');
    for (const [ch, qs] of Object.entries(chapters)) {
      let html = `<h5 class="mt-3 mb-2">${escHtml(ch)} (${qs.length} 题)</h5>`;
      qs.forEach(q => {
        const typeMap = { choice: '选择', fill: '填空', judge: '判断' };
        html += `<div class="question-item">
          <span class="badge bg-secondary me-2">${typeMap[q.type] || q.type}</span>
          ${escHtml(q.content)}
        </div>`;
      });
      container.innerHTML += html;
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/exam/setup', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const banks = await api.getBanks();
    if (banks.length === 0) {
      render('<div class="empty-state"><p>还没有题库</p><p class="text-muted">请先导入题库</p><a href="#/banks" class="btn btn-primary">去导入</a></div>');
      return;
    }
    render(`
      <div class="page-header"><h2>答题设置</h2></div>
      <div class="card mb-4"><div class="card-body">
        <h5>选择题库</h5>
        <div id="bank-select" class="row g-2"></div>
        <p class="mt-2 text-muted" id="selected-count">已选 0 个题库</p>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>答题模式</h5>
        <div class="d-flex gap-3 mt-2">
          <div class="mode-card" data-mode="sequential" onclick="selectMode(this)">顺序模式 <small class="d-block text-muted">按章节顺序出题</small></div>
          <div class="mode-card active" data-mode="random" onclick="selectMode(this)">随机模式 <small class="d-block text-muted">随机打乱出题</small></div>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>题型筛选</h5>
        <div class="d-flex gap-3 mt-2">
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="choice" checked> 选择题</label>
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="fill" checked> 填空题</label>
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="judge" checked> 判断题</label>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>单题计时</h5>
        <div class="row g-3 mt-1">
          <div class="col-auto"><label class="form-label">选择题</label><input type="number" class="form-control" id="timeout-choice" value="30" min="10" max="300"></div>
          <div class="col-auto"><label class="form-label">填空/判断</label><input type="number" class="form-control" id="timeout-fill" value="60" min="10" max="300"></div>
        </div>
      </div></div>
      <button class="btn btn-primary btn-lg w-100" onclick="startExam()">开始答题</button>
    `);
    const bankSelect = document.getElementById('bank-select');
    banks.forEach(b => {
      bankSelect.innerHTML += `
        <div class="col-md-4 col-6">
          <div class="bank-check-card" onclick="toggleBankSelect(this)">
            <div class="form-check">
              <input type="checkbox" class="form-check-input bank-checkbox" value="${b.id}">
              <label class="form-check-label">${escHtml(b.title)} <span class="text-muted">(${b.question_count} 题)</span></label>
            </div>
          </div>
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/exam', () => {
  showNav();
  if (!examId) { router.navigate('/exam/setup'); return; }
  render(`
    <div class="exam-container">
      <div class="exam-header">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span id="exam-progress-text">第 0/0 题</span>
          <span id="exam-timer" class="exam-timer">0:00</span>
        </div>
        <div class="progress exam-progress"><div id="exam-progress-bar" class="progress-bar" style="width:0%"></div></div>
      </div>
      <div id="exam-content" class="text-center py-5"><div class="spinner-border"></div></div>
    </div>
  `);
  loadNextQuestion();
});

router.add('/result/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getExamResult(id);
    const acc = (result.accuracy * 100).toFixed(0);
    render(`
      <div class="page-header text-center">
        <h2 class="result-title">答题完成！</h2>
        <div class="result-score">${acc}<small>分</small></div>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-success">${result.correct_count}</div><div class="stat-label">正确</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-danger">${result.wrong_count}</div><div class="stat-label">错误</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${acc}%</div><div class="stat-label">正确率</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${result.duration_seconds}s</div><div class="stat-label">用时</div></div></div>
      </div>
      <div id="result-answers"></div>
      <div class="d-flex gap-2 mt-3">
        <a href="#/exam/setup" class="btn btn-primary">再来一次</a>
        <a href="#/history/${result.exam_id}" class="btn btn-outline-primary">查看详情</a>
        <a href="#/dashboard" class="btn btn-outline-secondary">返回首页</a>
      </div>
    `);
    const container = document.getElementById('result-answers');
    result.answers.forEach((a, i) => {
      const icon = a.is_correct ? '<span class="text-success">\u2713</span>' : '<span class="text-danger">\u2717</span>';
      const userAns = Array.isArray(a.user_answer) ? a.user_answer.join(', ') : a.user_answer || '(未作答)';
      const correctAns = Array.isArray(a.correct_answer) ? a.correct_answer.join(', ') : a.correct_answer;
      container.innerHTML += `
        <div class="answer-review-item ${a.is_correct ? 'correct' : 'wrong'}">
          <div class="d-flex justify-content-between">
            <strong>第 ${i + 1} 题 ${icon}</strong>
            <small class="text-muted">${a.time_spent || 0}s</small>
          </div>
          <p class="mb-1 mt-1">${escHtml(a.content)}</p>
          <p class="mb-0 small"><span class="text-danger">你的答案: ${escHtml(userAns)}</span></p>
          ${!a.is_correct ? `<p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>` : ''}
          ${a.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(a.analysis)}</p>` : ''}
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/history', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const list = await api.getHistory();
    render(`
      <div class="page-header"><h2>练习历史</h2></div>
      ${list.length === 0 ? '<div class="empty-state"><p>还没有练习记录</p></div>' : ''}
      <div id="history-list"></div>
    `);
    if (list.length > 0) {
      const container = document.getElementById('history-list');
      list.forEach(h => {
        const date = new Date(h.started_at).toLocaleString('zh-CN');
        const acc = (h.accuracy * 100).toFixed(0);
        container.innerHTML += `
          <div class="history-item" onclick="router.navigate('/history/${h.id}')">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${date}</strong>
                <span class="badge bg-secondary ms-2">${h.mode === 'random' ? '随机' : '顺序'}</span>
                <span class="text-muted ms-2">${h.question_count} 题</span>
              </div>
              <div><span class="badge bg-success">${h.correct_count}/${h.question_count}</span> ${acc}% · ${h.duration_seconds}s</div>
            </div>
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/history/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getHistoryDetail(id);
    const acc = (result.accuracy * 100).toFixed(0);
    render(`
      <div class="page-header">
        <h2><a href="#/history" class="text-decoration-none me-2">&larr;</a>练习回顾</h2>
        <p class="text-muted">${result.correct_count}/${result.total_count} 正确 · ${acc}% · ${result.duration_seconds}s</p>
      </div>
      <div id="history-answers"></div>
      <div class="mt-3"><a href="#/exam/setup" class="btn btn-primary">重新练习</a></div>
    `);
    const container = document.getElementById('history-answers');
    result.answers.forEach((a, i) => {
      const icon = a.is_correct ? '<span class="text-success">\u2713</span>' : '<span class="text-danger">\u2717</span>';
      const userAns = Array.isArray(a.user_answer) ? a.user_answer.join(', ') : a.user_answer || '(未作答)';
      const correctAns = Array.isArray(a.correct_answer) ? a.correct_answer.join(', ') : a.correct_answer;
      container.innerHTML += `
        <div class="answer-review-item ${a.is_correct ? 'correct' : 'wrong'}">
          <div class="d-flex justify-content-between">
            <strong>第 ${i + 1} 题 ${icon}</strong>
            <small class="text-muted">${a.time_spent || 0}s</small>
          </div>
          <p class="mb-1 mt-1">${escHtml(a.content)}</p>
          <p class="mb-0 small"><span class="text-danger">你的答案: ${escHtml(userAns)}</span></p>
          ${!a.is_correct ? `<p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>` : ''}
          ${a.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(a.analysis)}</p>` : ''}
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/wrong-answers', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const wrongs = await api.getWrongAnswers();
    render(`
      <div class="page-header"><h2>错题本</h2><span class="text-muted">共 ${wrongs.length} 道错题</span></div>
      ${wrongs.length === 0 ? '<div class="empty-state"><p>太棒了，还没有错题！</p></div>' : ''}
      <div id="wrong-list"></div>
    `);
    if (wrongs.length > 0) {
      const container = document.getElementById('wrong-list');
      let currentBank = '';
      wrongs.forEach(w => {
        if (w.bank_title !== currentBank) {
          currentBank = w.bank_title;
          container.innerHTML += `<h5 class="mt-3 mb-2">${escHtml(currentBank)}</h5>`;
        }
        const userAns = Array.isArray(w.user_answer) ? w.user_answer.join(', ') : w.user_answer || '(未作答)';
        const correctAns = Array.isArray(w.correct_answer) ? w.correct_answer.join(', ') : w.correct_answer;
        container.innerHTML += `
          <div class="answer-review-item wrong">
            <p class="mb-1"><span class="badge bg-danger me-1">\u2717</span> ${escHtml(w.content)}</p>
            <p class="mb-0 small text-danger">你的答案: ${escHtml(userAns)}</p>
            <p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>
            ${w.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(w.analysis)}</p>` : ''}
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

function render(html) {
  document.getElementById('content').innerHTML = html;
}

function showNav() {
  document.getElementById('navbar').classList.remove('d-none');
  document.getElementById('nav-username').textContent = state.user ? state.user.username : '';
  $$('.nav-link').forEach(el => el.classList.remove('active'));
  const hash = location.hash.split('?')[0];
  document.querySelectorAll(`.nav-link[href="${hash}"]`).forEach(el => el.classList.add('active'));
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function logout() {
  api.setToken(null);
  state.user = null;
  router.navigate('/login');
}

function selectMode(el) {
  $$('.mode-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function toggleBankSelect(el) {
  const cb = el.querySelector('.bank-checkbox');
  cb.checked = !cb.checked;
  el.classList.toggle('selected');
  const count = document.querySelectorAll('.bank-checkbox:checked').length;
  document.getElementById('selected-count').textContent = `已选 ${count} 个题库`;
}

async function startExam() {
  const selectedBanks = [...document.querySelectorAll('.bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const mode = document.querySelector('.mode-card.active')?.dataset.mode || 'random';
  const types = [...document.querySelectorAll('.type-filter:checked')].map(cb => cb.value);
  const choiceTimeout = parseInt(document.getElementById('timeout-choice').value) || 30;
  const fillTimeout = parseInt(document.getElementById('timeout-fill').value) || 60;
  try {
    const res = await api.startExam({ bank_ids: selectedBanks, mode, types, choice_timeout: choiceTimeout, judge_fill_timeout: fillTimeout });
    examId = res.exam_id;
    examTotalCount = res.total_count;
    router.navigate('/exam');
  } catch (err) {
    alert(err.message);
  }
}

async function loadNextQuestion() {
  if (examTimerInterval) clearInterval(examTimerInterval);
  if (!examId) return;
  try {
    const data = await api.getCurrentQuestion(examId);
    if (!data.question) {
      router.navigate(`/result/${examId}`);
      return;
    }
    document.getElementById('exam-progress-text').textContent = `第 ${data.current_index}/${data.total_count} 题`;
    document.getElementById('exam-progress-bar').style.width = `${((data.current_index - 1) / data.total_count) * 100}%`;

    const isChoice = data.question.type === 'choice';
    examTimeoutSeconds = isChoice ? (parseInt(document.getElementById('timeout-choice')?.value) || 30) : (parseInt(document.getElementById('timeout-fill')?.value) || 60);
    state.questionStartTime = Date.now();

    const q = data.question;
    const typeMap = { choice: '选择题', fill: '填空题', judge: '判断题' };
    let optionsHtml = '';
    if (q.type === 'choice') {
      const opts = JSON.parse(q.options || '[]');
      opts.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        optionsHtml += `<div class="choice-option" onclick="selectChoice(this, '${letter}')">${escHtml(opt)}</div>`;
      });
    } else if (q.type === 'judge') {
      optionsHtml = `
        <div class="d-flex gap-3 justify-content-center mt-3">
          <div class="choice-option" onclick="selectChoice(this, '\u5bf9')">对</div>
          <div class="choice-option" onclick="selectChoice(this, '\u9519')">错</div>
        </div>
      `;
    } else if (q.type === 'fill') {
      const answerRaw = q.answer;
      try {
        const parsed = JSON.parse(answerRaw);
        if (Array.isArray(parsed) && parsed.length > 1) {
          let multiHtml = '<div class="d-flex flex-wrap gap-2 mt-3 justify-content-center">';
          parsed.forEach((_, i) => {
            multiHtml += `<input type="text" class="form-control fill-input" style="width:120px;display:inline-block" data-idx="${i}" placeholder="空 ${i + 1}">`;
          });
          multiHtml += '</div>';
          optionsHtml = multiHtml;
        } else {
          optionsHtml = `<input type="text" class="form-control form-control-lg mt-3" id="fill-answer" placeholder="请输入答案">`;
        }
      } catch {
        optionsHtml = `<input type="text" class="form-control form-control-lg mt-3" id="fill-answer" placeholder="请输入答案">`;
      }
    }

    document.getElementById('exam-content').innerHTML = `
      <div class="exam-question">
        <div class="mb-3">
          <span class="badge bg-primary me-2">${typeMap[q.type] || q.type}</span>
          ${q.chapter ? `<span class="badge bg-secondary">${escHtml(q.chapter)}</span>` : ''}
        </div>
        <h4 class="mb-4">${escHtml(q.content)}</h4>
        <div id="options-area">${optionsHtml}</div>
        <button class="btn btn-primary btn-lg mt-4" id="submit-answer-btn" onclick="submitCurrentAnswer()" disabled>提交答案</button>
      </div>
    `;

    if (q.type === 'fill') {
      document.getElementById('submit-answer-btn').disabled = false;
    } else {
      selectedAnswer = null;
    }

    startTimer();
  } catch {
    document.getElementById('exam-content').innerHTML = '<div class="alert alert-danger">加载题目失败</div>';
  }
}

function selectChoice(el, value) {
  $$('.choice-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAnswer = value;
  document.getElementById('submit-answer-btn').disabled = false;
}

function startTimer() {
  let remaining = examTimeoutSeconds;
  const timerEl = document.getElementById('exam-timer');
  timerEl.textContent = formatTime(remaining);
  timerEl.className = 'exam-timer';
  if (examTimerInterval) clearInterval(examTimerInterval);
  examTimerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = formatTime(remaining);
    timerEl.className = 'exam-timer';
    if (remaining <= 10) timerEl.classList.add('timer-danger');
    else if (remaining <= 30) timerEl.classList.add('timer-warning');
    if (remaining <= 0) {
      clearInterval(examTimerInterval);
      submitCurrentAnswer();
    }
  }, 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function submitCurrentAnswer() {
  if (!examId) return;
  clearInterval(examTimerInterval);
  const btn = document.getElementById('submit-answer-btn');
  if (btn) btn.disabled = true;

  const timeSpent = Math.max(1, Math.floor((Date.now() - state.questionStartTime) / 1000));

  let userAnswer = selectedAnswer || null;
  const fillInputs = document.querySelectorAll('.fill-input');
  if (fillInputs.length > 0) {
    userAnswer = [...fillInputs].map(inp => inp.value.trim()).filter(v => v !== '');
    if (userAnswer.length === 0) userAnswer = null;
    else if (userAnswer.length === 1) userAnswer = userAnswer[0];
  }
  const singleFill = document.getElementById('fill-answer');
  if (singleFill) userAnswer = singleFill.value.trim() || null;

  try {
    const data = await api.getCurrentQuestion(examId);
    if (!data.question) { router.navigate(`/result/${examId}`); return; }
    const qid = data.question.id;
    const result = await api.submitAnswer(examId, qid, userAnswer, timeSpent);

    const feedbackClass = result.is_correct ? 'feedback-correct' : 'feedback-wrong';
    const correctAns = Array.isArray(result.correct_answer) ? result.correct_answer.join(', ') : result.correct_answer;
    document.getElementById('exam-content').innerHTML = `
      <div class="exam-question">
        <div class="feedback ${feedbackClass}">
          <h3>${result.is_correct ? '\u2713 回答正确！' : '\u2717 回答错误'}</h3>
          ${!result.is_correct ? `<p class="mb-1">正确答案: <strong>${escHtml(correctAns)}</strong></p>` : ''}
          ${result.analysis ? `<p class="mb-0 small mt-2">解析: ${escHtml(result.analysis)}</p>` : ''}
        </div>
        <button class="btn btn-primary btn-lg mt-3" onclick="goToNext()">${result.is_last ? '查看结果' : '下一题'}</button>
      </div>
    `;
    if (result.is_last) {
      const eid = examId;
      examId = null;
      document.querySelector('.exam-header')?.remove();
    }
  } catch (err) {
    alert(err.message);
    if (btn) btn.disabled = false;
  }
}

function goToNext() {
  if (!examId) {
    const eid = examId;
    router.navigate(`/result/${eid}`);
    return;
  }
  loadNextQuestion();
}

let importFileList = [];

function showImportModal() {
  importFileList = [];
  document.getElementById('import-file').value = '';
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-btn').disabled = true;
  new bootstrap.Modal(document.getElementById('importModal')).show();
}

function previewImport(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  importFileList = [];
  let pending = files.length;
  let hasError = false;
  const container = document.getElementById('import-preview');
  container.innerHTML = '';

  for (const file of files) {
    const reader = new FileReader();
    reader._fileName = file.name;
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.title || !data.questions) {
          throw new Error('缺少 title 或 questions 字段');
        }
        importFileList.push(data);
        container.innerHTML += `
          <div class="alert alert-info mb-2">
            <strong>${escHtml(data.title)}</strong>
            <span class="text-muted ms-2">${data.questions.length} 题</span>
            <small class="text-muted ms-2">(${escHtml(ev.target._fileName)})</small>
          </div>
        `;
      } catch (err) {
        hasError = true;
        container.innerHTML += `
          <div class="alert alert-danger mb-2 py-2">
            ${escHtml(ev.target._fileName)}: 无效的 JSON 文件 — ${escHtml(err.message)}
          </div>
        `;
      } finally {
        pending--;
        if (pending === 0) {
          document.getElementById('import-btn').disabled = hasError || importFileList.length === 0;
        }
      }
    };
    reader.readAsText(file);
  }
}

async function doImport() {
  if (importFileList.length === 0) return;
  const btn = document.getElementById('import-btn');
  btn.disabled = true; btn.innerHTML = '导入中...';
  const preview = document.getElementById('import-preview');

  try {
    const res = await api.importBanksMultiple(importFileList);
    preview.innerHTML = '';
    let allOk = true;
    for (const r of res.results) {
      if (r.success) {
        preview.innerHTML += `<div class="alert alert-success mb-2 py-2">${escHtml(r.title)} ✓ (${r.question_count} 题)</div>`;
      } else {
        allOk = false;
        preview.innerHTML += `<div class="alert alert-danger mb-2 py-2">${escHtml(r.title)} ✗ — ${escHtml(r.error)}</div>`;
      }
    }
    if (allOk) {
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        router.navigate('/banks');
      }, 800);
    } else {
      btn.disabled = false; btn.innerHTML = '确认导入（仅导入成功的）';
    }
  } catch (err) {
    preview.innerHTML = `<div class="alert alert-danger">导入失败: ${err.message}</div>`;
    btn.disabled = false; btn.innerHTML = '确认导入';
  }
}

function downloadSample() {
  const sample = {
    title: "示例题库",
    description: "这是一个示例题库",
    questions: [
      { type: "choice", chapter: "第一章 基础", content: "中国的首都是？", options: ["A. 上海", "B. 北京", "C. 广州", "D. 深圳"], answer: "B", analysis: "北京是中国的首都。" },
      { type: "fill", content: "中国的首都是____。", answer: "北京" },
      { type: "fill", content: "中国的四大发明是____、____、____和____。", answer: ["造纸术", "印刷术", "火药", "指南针"] },
      { type: "judge", content: "长江是中国最长的河流。", answer: "对" },
    ]
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sample-question-bank.json';
  a.click();
}

function confirmDeleteBank(id, title) {
  if (!confirm(`确定删除题库「${title}」吗？该操作不可恢复。`)) return;
  api.deleteBank(id).then(() => router.navigate('/banks')).catch(err => alert(err.message));
}

async function init() {
  const authed = await checkAuth();
  if (!authed && !location.hash.match(/^\#\/(login|register)$/)) {
    router.navigate('/login');
  }
  router.resolve();
}

document.addEventListener('DOMContentLoaded', init);
