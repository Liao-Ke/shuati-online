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
let examCurrentIndex = 0;
let examProgress = null;
let examPaused = false;
let examPauseRemaining = 0;

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
        <h5>题目数量</h5>
        <div class="mt-2">
          <label class="d-flex align-items-center gap-2 mb-2">
            <input type="checkbox" class="form-check-input" id="question-count-all" checked onchange="toggleQuestionCountAll()">
            <span>全部题目</span>
          </label>
          <div id="question-count-custom" class="question-count-custom disabled">
            <div class="d-flex align-items-center gap-3 mb-2">
              <input type="range" class="form-range question-count-slider" id="question-count-slider" min="1" max="100" value="10" oninput="syncCountFromSlider()">
              <input type="number" class="form-control question-count-input" id="question-count-input" value="10" min="1" max="100" oninput="syncCountFromInput()">
              <span class="text-muted small text-nowrap">（共 <span id="question-count-total">0</span> 题可选）</span>
            </div>
            <div class="d-flex gap-2 flex-wrap" id="question-count-quick"></div>
          </div>
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
          <div class="bank-check-card" data-question-count="${b.question_count}" onclick="toggleBankSelect(this)">
            <div class="form-check">
              <input type="checkbox" class="form-check-input bank-checkbox" value="${b.id}">
              <label class="form-check-label">${escHtml(b.title)} <span class="text-muted">(${b.question_count} 题)</span></label>
            </div>
          </div>
        </div>
      `;
    });
    const firstCard = bankSelect.querySelector('.bank-check-card');
    if (firstCard) {
      firstCard.classList.add('selected');
      firstCard.querySelector('.bank-checkbox').checked = true;
      document.getElementById('selected-count').textContent = '已选 1 个题库';
    }
    updateQuestionCount();
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/exam', async () => {
  showNav();
  if (!examId) { router.navigate('/exam/setup'); return; }
  render(`
    <div class="exam-layout">
      <div class="exam-main">
        <div class="exam-header">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span id="exam-progress-text">第 0/0 题</span>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-outline-secondary btn-sm" id="pause-btn" onclick="pauseExam()">⏸ 暂停</button>
              <button class="btn btn-outline-danger btn-sm" id="finish-btn" onclick="finishExam()">✕ 结束</button>
            </div>
            <span id="exam-timer" class="exam-timer">0:00</span>
          </div>
          <div class="progress exam-progress"><div id="exam-progress-bar" class="progress-bar" style="width:0%"></div></div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <button class="btn btn-outline-secondary btn-sm" id="prev-btn" onclick="navigateExam(-1)">← 上一题</button>
            <span class="text-muted small" id="exam-nav-hint"></span>
            <button class="btn btn-outline-secondary btn-sm" id="next-btn" onclick="navigateExam(1)">下一题 →</button>
          </div>
        </div>
        <div id="exam-content" class="text-center py-5"><div class="spinner-border"></div></div>
        <div id="exam-pause-overlay" class="exam-pause-overlay d-none" onclick="resumeExam()">
          <div class="exam-pause-box">
            <div class="exam-pause-icon">⏸</div>
            <div class="exam-pause-text">已暂停</div>
            <button class="btn btn-primary btn-lg" onclick="event.stopPropagation();resumeExam()">▶ 继续答题</button>
            <p class="text-muted mt-2 mb-0 small">按空格键继续</p>
          </div>
        </div>
      </div>
      <div class="exam-sidebar" id="exam-sidebar">
        <div class="exam-sidebar-header">题目列表</div>
        <div id="question-grid"></div>
        <div class="exam-sidebar-legend">
          <span><span class="dot dot-correct"></span> 正确</span>
          <span><span class="dot dot-wrong"></span> 错误</span>
          <span><span class="dot dot-unanswered"></span> 未答</span>
        </div>
      </div>
    </div>
  `);
  examCurrentIndex = 0;
  examPaused = false;
  examPauseRemaining = 0;
  document.removeEventListener('keydown', examKeyHandler);
  examProgress = await api.getExamProgress(examId);
  renderQuestionGrid();
  loadQuestionByIndex(0);
  document.addEventListener('keydown', examKeyHandler);
});

function examKeyHandler(e) {
  if (e.key === ' ' && examPaused) {
    e.preventDefault();
    resumeExam();
  }
}

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

let reviewQuestions = [];
let reviewFilter = null;

router.add('/review/setup', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const banks = await api.getBanks();
    if (banks.length === 0) {
      render('<div class="empty-state"><p>还没有题库</p><p class="text-muted">请先导入题库</p><a href="#/banks" class="btn btn-primary">去导入</a></div>');
      return;
    }
    render(`
      <div class="page-header"><h2>背题设置</h2></div>
      <div class="card mb-4"><div class="card-body">
        <h5>选择题库</h5>
        <div id="review-bank-select" class="row g-2"></div>
        <p class="mt-2 text-muted" id="review-selected-count">已选 0 个题库</p>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>题型筛选</h5>
        <div class="d-flex gap-3 mt-2">
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="choice" checked> 选择题</label>
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="fill" checked> 填空题</label>
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="judge" checked> 判断题</label>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>章节筛选 <small class="text-muted">（可选）</small></h5>
        <select class="form-select" id="review-chapter-select">
          <option value="">全部章节</option>
        </select>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="review-show-reviewing">
          <label class="form-check-label">只看待复习的题目（已标记"记住"的隐藏）</label>
        </div>
      </div></div>
      <button class="btn btn-primary btn-lg w-100" onclick="startReview()">开始背题</button>
    `);
    const bankSelect = document.getElementById('review-bank-select');
    banks.forEach(b => {
      bankSelect.innerHTML += `
        <div class="col-md-4 col-6">
          <div class="bank-check-card" onclick="toggleReviewBankSelect(this)">
            <div class="form-check">
              <input type="checkbox" class="form-check-input review-bank-checkbox" value="${b.id}">
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

function toggleReviewBankSelect(el) {
  const cb = el.querySelector('.review-bank-checkbox');
  cb.checked = !cb.checked;
  el.classList.toggle('selected');
  const count = document.querySelectorAll('.review-bank-checkbox:checked').length;
  document.getElementById('review-selected-count').textContent = `已选 ${count} 个题库`;
}

async function startReview() {
  const selectedBanks = [...document.querySelectorAll('.review-bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const types = [...document.querySelectorAll('.review-type-filter:checked')].map(cb => cb.value);
  const chapter = document.getElementById('review-chapter-select').value || null;
  const showReviewingOnly = document.getElementById('review-show-reviewing').checked;
  reviewFilter = { bank_ids: selectedBanks, types, chapter, show_reviewing_only: showReviewingOnly };
  router.navigate('/review');
}

router.add('/review', async () => {
  showNav();
  if (!reviewFilter) { router.navigate('/review/setup'); return; }
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    reviewQuestions = await api.getReviewQuestions(reviewFilter);
    renderReviewPage();
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

function renderReviewPage() {
  if (reviewQuestions.length === 0) {
    render(`
      <div class="page-header">
        <h2><a href="#/review/setup" class="text-decoration-none me-2">&larr;</a> 背题模式</h2>
      </div>
      <div class="empty-state"><p>没有符合条件的题目</p></div>
    `);
    return;
  }
  const knownCount = reviewQuestions.filter(q => q.review_status === 'known').length;
  const reviewingCount = reviewQuestions.filter(q => q.review_status === 'reviewing' || !q.review_status).length;
  const totalStr = `共 ${reviewQuestions.length} 题 · 已掌握 ${knownCount} · 待复习 ${reviewingCount}`;
  let html = `
    <div class="page-header">
      <h2><a href="#/review/setup" class="text-decoration-none me-2">&larr;</a> 背题模式</h2>
      <span class="text-muted">${totalStr}</span>
    </div>
    <div id="review-stats-bar" class="mb-3">
      <div class="d-flex gap-3 align-items-center flex-wrap">
        <span><strong>${reviewQuestions.length}</strong> 题</span>
        <span class="text-success">已掌握 <strong>${knownCount}</strong></span>
        <span class="text-warning">待复习 <strong>${reviewingCount}</strong></span>
      </div>
    </div>
  `;
  reviewQuestions.forEach((q, i) => {
    const typeMap = { choice: '选择', fill: '填空', judge: '判断' };
    const isKnown = q.review_status === 'known';
    const statusBadge = isKnown
      ? '<span class="badge bg-success">已掌握</span>'
      : '<span class="badge bg-warning text-dark">待复习</span>';
    let optionsHtml = '';
    if (q.type === 'choice' && q.options) {
      try {
        const opts = JSON.parse(q.options);
        opts.forEach(opt => {
          optionsHtml += `<div class="review-option">${escHtml(opt)}</div>`;
        });
      } catch { /* ignore */ }
    }
    const correctDisplay = q.answer || '';
    const analysisDisplay = q.analysis ? `<div class="review-analysis mt-2">解析：${escHtml(q.analysis)}</div>` : '';
    html += `
      <div class="review-question-card card mb-3" data-id="${q.id}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <div class="mb-2">
                <span class="badge bg-primary me-1">${typeMap[q.type] || q.type}</span>
                ${q.chapter ? `<span class="badge bg-secondary me-1">${escHtml(q.chapter)}</span>` : ''}
                ${statusBadge}
              </div>
              <h5 class="mb-3">${escHtml(q.content)}</h5>
              ${optionsHtml}
              <div class="review-answer mt-3 p-3 bg-light rounded">
                <strong>答案：</strong>${escHtml(correctDisplay)}
                ${analysisDisplay}
              </div>
            </div>
            <div class="ms-3 text-nowrap review-toggle-group">
              <button class="btn btn-sm ${isKnown ? 'btn-success' : 'btn-outline-success'}" onclick="setReviewStatus(${q.id}, 'known', this)">记住了</button>
              <button class="btn btn-sm ${!isKnown ? 'btn-warning' : 'btn-outline-warning'}" onclick="setReviewStatus(${q.id}, 'reviewing', this)">待复习</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  render(html);
}

async function setReviewStatus(questionId, status, btn) {
  try {
    const stats = await api.markReview(questionId, status);
    const q = reviewQuestions.find(x => x.id === questionId);
    if (q) q.review_status = status;
    const knownCount = reviewQuestions.filter(x => x.review_status === 'known').length;
    const reviewingCount = reviewQuestions.filter(x => x.review_status === 'reviewing' || !x.review_status).length;
    const statsBar = document.getElementById('review-stats-bar');
    if (statsBar) {
      statsBar.innerHTML = `
        <div class="d-flex gap-3 align-items-center flex-wrap">
          <span><strong>${reviewQuestions.length}</strong> 题</span>
          <span class="text-success">已掌握 <strong>${knownCount}</strong></span>
          <span class="text-warning">待复习 <strong>${reviewingCount}</strong></span>
        </div>
      `;
    }
    const card = document.querySelector(`.review-question-card[data-id="${questionId}"]`);
    if (card) {
      const badge = card.querySelector('.badge.bg-success, .badge.bg-warning');
      if (badge) {
        if (status === 'known') {
          badge.className = 'badge bg-success';
          badge.textContent = '已掌握';
        } else {
          badge.className = 'badge bg-warning text-dark';
          badge.textContent = '待复习';
        }
      }
      const btns = card.querySelectorAll('.review-toggle-group button');
      if (btns.length === 2) {
        btns[0].className = status === 'known' ? 'btn btn-sm btn-success' : 'btn btn-sm btn-outline-success';
        btns[1].className = status === 'reviewing' ? 'btn btn-sm btn-warning' : 'btn btn-sm btn-outline-warning';
      }
    }
  } catch (err) {
    alert('标记失败: ' + err.message);
  }
}

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
  updateQuestionCount();
}

async function startExam() {
  const selectedBanks = [...document.querySelectorAll('.bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const mode = document.querySelector('.mode-card.active')?.dataset.mode || 'random';
  const types = [...document.querySelectorAll('.type-filter:checked')].map(cb => cb.value);
  const allQuestions = document.getElementById('question-count-all').checked;
  const questionCount = allQuestions ? null : parseInt(document.getElementById('question-count-input').value) || null;
  const choiceTimeout = parseInt(document.getElementById('timeout-choice').value) || 30;
  const fillTimeout = parseInt(document.getElementById('timeout-fill').value) || 60;
  try {
    const res = await api.startExam({ bank_ids: selectedBanks, mode, types, question_count: questionCount, choice_timeout: choiceTimeout, judge_fill_timeout: fillTimeout });
    examId = res.exam_id;
    examTotalCount = res.total_count;
    router.navigate('/exam');
  } catch (err) {
    alert(err.message);
  }
}

function updateNavButtons(index, total) {
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  const hint = document.getElementById('exam-nav-hint');
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index >= total - 1;
  if (hint) hint.textContent = `${index + 1} / ${total}`;
}

function renderQuestionGrid() {
  const grid = document.getElementById('question-grid');
  if (!grid || !examProgress) return;
  const answeredMap = {};
  for (const a of examProgress.answers) {
    answeredMap[a.index] = a.is_correct;
  }
  let html = '';
  for (let i = 0; i < examProgress.total_count; i++) {
    let cls = 'qnum';
    if (i === examCurrentIndex) {
      cls += ' qnum-current';
    } else if (i in answeredMap) {
      cls += answeredMap[i] ? ' qnum-correct' : ' qnum-wrong';
    } else {
      cls += ' qnum-empty';
    }
    html += `<div class="${cls}" onclick="goToQuestion(${i})">${i + 1}</div>`;
  }
  grid.innerHTML = html;
}

function goToQuestion(index) {
  if (index === examCurrentIndex) return;
  loadQuestionByIndex(index);
}

async function loadQuestionByIndex(index) {
  if (examTimerInterval) clearInterval(examTimerInterval);
  if (!examId) return;
  try {
    const data = await api.getCurrentQuestion(examId, index);
    if (!data.question) {
      router.navigate(`/result/${examId}`);
      return;
    }
    examCurrentIndex = index;
    renderQuestionGrid();
    document.getElementById('exam-progress-text').textContent = `第 ${index + 1}/${data.total_count} 题`;
    document.getElementById('exam-progress-bar').style.width = `${((index + 1) / data.total_count) * 100}%`;
    updateNavButtons(index, data.total_count);

    const typeMap = { choice: '选择题', fill: '填空题', judge: '判断题' };
    const q = data.question;

    if (data.is_answered) {
      const icon = data.is_correct ? '<span class="text-success">\u2713</span>' : '<span class="text-danger">\u2717</span>';
      const feedbackClass = data.is_correct ? 'feedback-correct' : 'feedback-wrong';
      document.getElementById('exam-timer').textContent = '';
      document.getElementById('exam-content').innerHTML = `
        <div class="exam-question">
          <div class="mb-3">
            <span class="badge bg-primary me-2">${typeMap[q.type] || q.type}</span>
            ${q.chapter ? `<span class="badge bg-secondary">${escHtml(q.chapter)}</span>` : ''}
          </div>
          <h4 class="mb-4">${escHtml(q.content)}</h4>
          <div class="feedback ${feedbackClass}">
            <h3>${icon} ${data.is_correct ? '回答正确！' : '回答错误'}</h3>
            <p class="mb-1">你的答案: <strong>${escHtml(data.user_answer || '(未作答)')}</strong></p>
            <p class="mb-1">正确答案: <strong>${escHtml(data.correct_answer)}</strong></p>
          </div>
        </div>
      `;
      return;
    }

    const isChoice = q.type === 'choice';
    examTimeoutSeconds = isChoice ? (parseInt(document.getElementById('timeout-choice')?.value) || 30) : (parseInt(document.getElementById('timeout-fill')?.value) || 60);
    state.questionStartTime = Date.now();

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

function navigateExam(delta) {
  if (examPaused) return;
  const newIndex = examCurrentIndex + delta;
  if (newIndex < 0 || newIndex >= examTotalCount) return;
  loadQuestionByIndex(newIndex);
}

function pauseExam() {
  if (examPaused) return;
  clearInterval(examTimerInterval);
  examTimerInterval = null;
  examPaused = true;
  const timerEl = document.getElementById('exam-timer');
  examPauseRemaining = parseTime(timerEl.textContent);
  document.getElementById('exam-pause-overlay').classList.remove('d-none');
}

function resumeExam() {
  if (!examPaused) return;
  examPaused = false;
  document.getElementById('exam-pause-overlay').classList.add('d-none');
  startTimer(examPauseRemaining);
}

async function finishExam() {
  if (!confirm('确定要提前结束吗？未答的题目将不计入成绩。')) return;
  if (examPaused) resumeExam();
  clearInterval(examTimerInterval);
  try {
    await api.finishExam(examId);
    document.removeEventListener('keydown', examKeyHandler);
    router.navigate(`/result/${examId}`);
  } catch (err) {
    alert('结束失败: ' + err.message);
  }
}

function parseTime(str) {
  const parts = str.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function selectChoice(el, value) {
  $$('.choice-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAnswer = value;
  document.getElementById('submit-answer-btn').disabled = false;
}

function startTimer(remaining) {
  if (remaining === undefined) remaining = examTimeoutSeconds;
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
    const data = await api.getCurrentQuestion(examId, examCurrentIndex);
    if (!data.question) { router.navigate(`/result/${examId}`); return; }
    const qid = data.question.id;
    await api.submitAnswer(examId, qid, userAnswer, timeSpent);
    examProgress = await api.getExamProgress(examId);

    loadQuestionByIndex(examCurrentIndex);
  } catch (err) {
    alert(err.message);
    if (btn) btn.disabled = false;
  }
}

function goToNext() {
  navigateExam(1);
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
        router.resolve();
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

function updateQuestionCount() {
  const cards = document.querySelectorAll('.bank-check-card.selected');
  let total = 0;
  cards.forEach(c => {
    total += parseInt(c.dataset.questionCount) || 0;
  });
  const allCheckbox = document.getElementById('question-count-all');
  const slider = document.getElementById('question-count-slider');
  const input = document.getElementById('question-count-input');
  const totalEl = document.getElementById('question-count-total');
  if (!slider || !input || !totalEl) return;
  totalEl.textContent = total;
  const cur = parseInt(input.value) || total;
  const val = Math.min(Math.max(cur, 1), total || 1);
  slider.max = total || 1;
  input.max = total || 1;
  slider.value = val;
  input.value = val;
  renderQuickButtons(total);
}

function renderQuickButtons(total) {
  const container = document.getElementById('question-count-quick');
  if (!container) return;
  const presets = [10, 20, 50].filter(n => n < total);
  if (presets.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = '快捷：' + presets.map(n =>
    `<button type="button" class="btn btn-outline-secondary btn-sm" onclick="setQuickCount(${n})">${n}</button>`
  ).join(' ');
}

function toggleQuestionCountAll() {
  const all = document.getElementById('question-count-all').checked;
  const custom = document.getElementById('question-count-custom');
  custom.classList.toggle('disabled', all);
  const inputs = custom.querySelectorAll('input, button');
  inputs.forEach(el => el.disabled = all);
}

function syncCountFromSlider() {
  const slider = document.getElementById('question-count-slider');
  const input = document.getElementById('question-count-input');
  input.value = slider.value;
}

function syncCountFromInput() {
  const slider = document.getElementById('question-count-slider');
  const input = document.getElementById('question-count-input');
  let v = parseInt(input.value) || 1;
  const max = parseInt(input.max) || 1;
  if (v < 1) v = 1;
  if (v > max) v = max;
  input.value = v;
  slider.value = v;
}

function setQuickCount(n) {
  const slider = document.getElementById('question-count-slider');
  const input = document.getElementById('question-count-input');
  slider.value = n;
  input.value = n;
}

async function init() {
  const authed = await checkAuth();
  if (!authed && !location.hash.match(/^\#\/(login|register)$/)) {
    router.navigate('/login');
  }
  router.resolve();
}

document.addEventListener('DOMContentLoaded', init);
