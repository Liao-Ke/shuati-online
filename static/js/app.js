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
let selectedMultiAnswers = [];
let examTimerInterval = null;
let examTimeoutSeconds = 30;
let examCurrentIndex = 0;
let examProgress = null;
let examPaused = false;
let examPauseRemaining = 0;
let examFullPreview = false;
let examScrollTimer = null;
let examTimerMode = 'per_question';
let examStartedAt = null;
let examElapsedInterval = null;
let examElapsedOffset = 0;

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
              <button class="btn btn-outline-danger btn-sm ms-1" data-bank-id="${b.id}" onclick="confirmDeleteBank(this.dataset.bankId)">删除</button>
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
        <h2>
          <a href="#/banks" class="text-decoration-none me-2">&larr;</a>
          <span id="bank-title">${escHtml(bank.title)}</span>
          <button class="btn btn-sm btn-outline-secondary ms-2" title="编辑题库" onclick="showBankEditModal(${bank.id})">
            <i class="bi bi-pencil"></i>
          </button>
        </h2>
        <div class="mb-2">
          <button class="btn btn-outline-primary btn-sm me-2" onclick="api.exportBank(${bank.id}).catch(e => alert(e.message))">导出</button>
          <button class="btn btn-primary btn-sm" onclick="showAddQuestion(${bank.id})">+ 新增题目</button>
        </div>
        <p class="text-muted">共 ${bank.question_count} 题</p>
      </div>
      <div id="questions-by-chapter"></div>
    `);
    const typeMap = { choice: '选择', multiple: '多选', fill: '填空', judge: '判断' };
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
        html += `<div class="question-item d-flex align-items-start gap-2">
          <div class="flex-grow-1">
            <span class="badge bg-secondary me-2">${typeMap[q.type] || q.type}</span>
            ${escHtml(q.content)}
          </div>
          <div class="text-nowrap">
            <button class="btn btn-sm btn-outline-secondary py-0 px-1" title="编辑" onclick="showEditQuestion(${bank.id}, ${q.id})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0 px-1" title="删除" onclick="showDeleteQuestion(${bank.id}, ${q.id})"><i class="bi bi-trash"></i></button>
          </div>
        </div>`;
      });
      container.innerHTML += html;
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/exam/setup', async () => {
  window.removeEventListener('scroll', trackPreviewScroll);
  sessionStorage.removeItem('activeExamId');
  sessionStorage.removeItem('examCurrentIndex');
  sessionStorage.removeItem('examMode');
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
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="multiple" checked> 多选题</label>
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="fill" checked> 填空题</label>
          <label><input type="checkbox" class="form-check-input me-1 type-filter" value="judge" checked> 判断题</label>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>章节筛选 <small class="text-muted">（可选，不选则显示全部）</small></h5>
        <div id="exam-chapter-area" style="display:none">
          <div class="mb-1">
            <a href="#" class="text-decoration-none me-2" id="exam-chapter-select-all">全选</a>
            <a href="#" class="text-decoration-none" id="exam-chapter-deselect-all">取消全选</a>
          </div>
          <div id="exam-chapter-list" class="border rounded p-2" style="max-height:180px;overflow-y:auto">
            <span class="text-muted">请先选择题库</span>
          </div>
          <p class="mt-1 mb-0 text-muted small" id="exam-chapter-count"></p>
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
        <h5>计时方式</h5>
        <div class="d-flex gap-3 mt-2">
          <div class="mode-card active" data-timer="per_question" onclick="selectTimerMode(this)">单题计时 <small class="d-block text-muted">每题限时作答</small></div>
          <div class="mode-card" data-timer="elapsed" onclick="selectTimerMode(this)">整卷计时 <small class="d-block text-muted">记录总用时，不限时作答</small></div>
        </div>
        <div class="row g-3 mt-2" id="per-question-timeouts">
          <div class="col-auto"><label class="form-label">选择题</label><input type="number" class="form-control" id="timeout-choice" value="30" min="10" max="300"></div>
          <div class="col-auto"><label class="form-label">多选题</label><input type="number" class="form-control" id="timeout-multi" value="45" min="10" max="300"></div>
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
    document.getElementById('exam-chapter-select-all')?.addEventListener('click', (e) => { e.preventDefault(); selectAllExamChapters(); });
    document.getElementById('exam-chapter-deselect-all')?.addEventListener('click', (e) => { e.preventDefault(); deselectAllExamChapters(); });
    // 首次加载章节
    updateExamChapters();
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/exam', async () => {
  showNav();
  if (!examId) {
    const saved = sessionStorage.getItem('activeExamId');
    if (saved) { examId = parseInt(saved); } else { router.navigate('/exam/setup'); return; }
  }
  render(`
    <div class="exam-layout">
      <div class="exam-main">
        <div class="exam-header">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span id="exam-progress-text">第 0/0 题</span>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-outline-secondary btn-sm" id="mode-toggle-btn" onclick="toggleExamMode()">📋 整卷模式</button>
              <button class="btn btn-outline-secondary btn-sm" id="pause-btn" onclick="pauseExam()">⏸ 暂停</button>
              <button class="btn btn-outline-danger btn-sm" id="finish-btn" onclick="finishExam()">✕ 结束</button>
            </div>
            <span id="exam-timer" class="exam-timer">0:00</span>
            <span id="exam-elapsed" class="exam-elapsed d-none">总 0:00</span>
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
  examPaused = false;
  examPauseRemaining = 0;
  document.removeEventListener('keydown', examKeyHandler);
  const savedIdx = sessionStorage.getItem('examCurrentIndex');
  if (savedIdx) examCurrentIndex = parseInt(savedIdx);
  const savedMode = sessionStorage.getItem('examMode');
  if (savedMode) examFullPreview = savedMode === 'preview';
  examTimerMode = sessionStorage.getItem('examTimerMode') || 'per_question';
  const savedStarted = sessionStorage.getItem('examStartedAt');
  if (savedStarted) examStartedAt = savedStarted;
  examElapsedOffset = parseInt(sessionStorage.getItem('examElapsedOffset')) || 0;
  if (examTimerMode === 'elapsed') startElapsedTimer();
  examProgress = await api.getExamProgress(examId);
  if (examCurrentIndex >= examProgress.total_count) examCurrentIndex = 0;
  renderQuestionGrid();
  if (examFullPreview) {
    document.getElementById('mode-toggle-btn').textContent = '📖 单题模式';
    document.getElementById('prev-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('exam-nav-hint').style.display = 'none';
    if (examTimerMode === 'per_question') document.getElementById('exam-timer').style.display = 'none';
    document.querySelector('.exam-progress').style.display = 'none';
    document.getElementById('exam-progress-text').textContent = '整卷模式';
    document.querySelector('.exam-layout')?.classList.add('exam-layout-preview');
    await renderFullPreview();
    window.addEventListener('scroll', trackPreviewScroll, { passive: true });
    const scrollIdx = Math.min(examCurrentIndex, examTotalCount - 1);
    const scrollEl = document.querySelector(`.preview-card[data-index="${scrollIdx}"]`);
    if (scrollEl) {
      const top = scrollEl.getBoundingClientRect().top + window.scrollY - 80;
      setTimeout(() => window.scrollTo({ top, behavior: 'smooth' }), 50);
    }
  } else {
    loadQuestionByIndex(examCurrentIndex);
  }
  document.addEventListener('keydown', examKeyHandler);
});

function examKeyHandler(e) {
  if (e.key === ' ' && examPaused) {
    e.preventDefault();
    resumeExam();
  }
}

router.add('/result/:id', async ({ id }) => {
  if (examElapsedInterval) clearInterval(examElapsedInterval);
  window.removeEventListener('scroll', trackPreviewScroll);
  sessionStorage.removeItem('activeExamId');
  sessionStorage.removeItem('examCurrentIndex');
  sessionStorage.removeItem('examMode');
  sessionStorage.removeItem('examTimerMode');
  sessionStorage.removeItem('examStartedAt');
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getExamResult(id);
    const hasAnswers = result.answers.length > 0;
    const acc = hasAnswers ? (result.accuracy * 100).toFixed(0) : '—';
    const cc = hasAnswers ? result.correct_count : '—';
    const wc = hasAnswers ? result.wrong_count : '—';
    render(`
      <div class="page-header text-center">
        <h2 class="result-title">答题完成！</h2>
        <div class="result-score">${acc}<small>分</small></div>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-success">${cc}</div><div class="stat-label">正确</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-danger">${wc}</div><div class="stat-label">错误</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${acc}%</div><div class="stat-label">正确率</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${result.duration_seconds}s</div><div class="stat-label">用时</div></div></div>
      </div>
      <div id="result-answers"></div>
      <div class="d-flex gap-2 mt-3">
        <a href="#/exam/setup" class="btn btn-primary">再来一次</a>
        ${hasAnswers ? `<a href="#/history/${result.exam_id}" class="btn btn-outline-primary">查看详情</a>` : ''}
        <a href="#/dashboard" class="btn btn-outline-secondary">返回首页</a>
      </div>
    `);
    const container = document.getElementById('result-answers');
    if (!hasAnswers) {
      container.innerHTML = '<div class="empty-state"><p>还没有作答记录</p></div>';
      return;
    }
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
          ${renderOptions(a.options, a.user_answer, a.correct_answer)}
          <p class="mb-0 small"><span class="${a.is_correct ? 'text-success' : 'text-danger'}">你的答案: ${escHtml(userAns)}</span></p>
          <p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>
          ${a.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(a.analysis)}</p>` : ''}
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

router.add('/history', async () => {
  await loadHistory(1);
});

// 练习历史分页加载。后端 /api/history 已支持 page/page_size，前端 API 层 getHistory(page) 仅缺 UI 调用方。
// loadHistory 在顶层声明，供内联 onclick="loadHistory(N)" 调用（app.js 为经典脚本，函数声明为全局）。
async function loadHistory(page) {
  page = Number(page) || 1;
  if (page < 1) page = 1;
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const list = await api.getHistory(page);
    const pageSize = 20;
    const hasMore = list.length >= pageSize; // 返回数 < page_size 即到底
    const empty = list.length === 0;
    const showPager = !empty || page > 1; // 翻过头到空页时仍需控件以便回退
    render(`
      <div class="page-header"><h2>练习历史</h2></div>
      ${empty ? `<div class="empty-state"><p>${page > 1 ? '没有更多记录' : '还没有练习记录'}</p></div>` : ''}
      <div id="history-list"></div>
      ${showPager ? `
        <div class="d-flex justify-content-center align-items-center gap-2 mt-3">
          <button class="btn btn-outline-secondary btn-sm" onclick="loadHistory(${page - 1})"${page <= 1 ? ' disabled' : ''}>&larr; 上一页</button>
          <span class="text-muted">第 ${page} 页</span>
          <button class="btn btn-outline-secondary btn-sm" onclick="loadHistory(${page + 1})"${!hasMore ? ' disabled' : ''}>下一页 &rarr;</button>
        </div>
      ` : ''}
    `);
    const container = document.getElementById('history-list');
    if (container) {
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
}

router.add('/history/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getHistoryDetail(id);
    const hasAnswers = result.answers.length > 0;
    const acc = hasAnswers ? (result.accuracy * 100).toFixed(0) : '—';
    const cc = hasAnswers ? result.correct_count : '—';
    render(`
      <div class="page-header">
        <h2><a href="#/history" class="text-decoration-none me-2">&larr;</a>练习回顾</h2>
        <p class="text-muted">${cc}/${hasAnswers ? result.total_count : '—'} 正确 · ${acc}% · ${result.duration_seconds}s</p>
      </div>
      <div id="history-answers"></div>
      <div class="mt-3"><a href="#/exam/setup" class="btn btn-primary">重新练习</a></div>
    `);
    const container = document.getElementById('history-answers');
    if (!hasAnswers) {
      container.innerHTML = '<div class="empty-state"><p>该练习还没有作答记录</p></div>';
      return;
    }
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
          ${renderOptions(a.options, a.user_answer, a.correct_answer)}
          <p class="mb-0 small"><span class="${a.is_correct ? 'text-success' : 'text-danger'}">你的答案: ${escHtml(userAns)}</span></p>
          <p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>
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
      <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2>错题本</h2><span class="text-muted">共 ${wrongs.length} 道错题</span></div>
        <button class="btn btn-warning" id="wrong-practice-btn" ${wrongs.length === 0 ? 'disabled' : ''} onclick="openWrongPracticeModal()">
          📝 错题练习
        </button>
      </div>
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
            ${renderOptions(w.options, w.user_answer, w.correct_answer)}
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
let allChapters = [];

router.add('/review/setup', async () => {
  sessionStorage.removeItem('reviewFilter');
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
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="multiple" checked> 多选题</label>
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="fill" checked> 填空题</label>
          <label><input type="checkbox" class="form-check-input me-1 review-type-filter" value="judge" checked> 判断题</label>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>章节筛选 <small class="text-muted">（可选，不选则显示全部）</small></h5>
        <div id="review-chapter-area" style="display:none">

          <div class="mb-1">
            <a href="#" class="text-decoration-none me-2" onclick="selectAllChapters(event)">全选</a>
            <a href="#" class="text-decoration-none" onclick="deselectAllChapters(event)">取消全选</a>
          </div>
          <div id="review-chapter-list" class="border rounded p-2" style="max-height:180px;overflow-y:auto">
            <span class="text-muted">请先选择题库</span>
          </div>
          <p class="mt-1 mb-0 text-muted small" id="review-chapter-count"></p>
        </div>
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
    const firstCard = bankSelect.querySelector('.bank-check-card');
    if (firstCard) {
      firstCard.classList.add('selected');
      firstCard.querySelector('.review-bank-checkbox').checked = true;
      document.getElementById('review-selected-count').textContent = '已选 1 个题库';
      updateReviewChapters();
    }
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
  updateReviewChapters();
}

async function updateReviewChapters() {
  const selectedIds = [...document.querySelectorAll('.review-bank-checkbox:checked')].map(cb => parseInt(cb.value));
  const area = document.getElementById('review-chapter-area');
  const list = document.getElementById('review-chapter-list');
  if (!area || !list) return;
  if (selectedIds.length === 0) {
    area.style.display = 'none';
    return;
  }
  area.style.display = '';
  try {
    allChapters = await api.getReviewChapters({ bank_ids: selectedIds });
  } catch { allChapters = []; }
  renderChapterCheckboxes(allChapters);
}

function renderChapterCheckboxes(chapters) {
  const list = document.getElementById('review-chapter-list');
  const countEl = document.getElementById('review-chapter-count');
  if (chapters.length === 0) {
    list.innerHTML = '<span class="text-muted">题库中没有章节</span>';
    if (countEl) countEl.textContent = '';
    return;
  }
  list.innerHTML = chapters.map(c =>
    `<label class="d-block chapter-label"><input type="checkbox" class="form-check-input me-1 review-chapter-filter" value="${escHtml(c)}"> ${escHtml(c)}</label>`
  ).join('');
  updateChapterCount();
}


function selectAllChapters(e) {
  e.preventDefault();
  document.querySelectorAll('#review-chapter-list .review-chapter-filter').forEach(cb => { cb.checked = true; });
  updateChapterCount();
}

function deselectAllChapters(e) {
  e.preventDefault();
  document.querySelectorAll('#review-chapter-list .review-chapter-filter').forEach(cb => { cb.checked = false; });
  updateChapterCount();
}

function updateChapterCount() {
  const count = document.querySelectorAll('.review-chapter-filter:checked').length;
  const el = document.getElementById('review-chapter-count');
  if (el) el.textContent = count > 0 ? `已选 ${count} 个章节` : '';
}

/* ---- 答题模式章节筛选 ---- */

let examChapters = [];

async function updateExamChapters() {
  const selectedIds = [...document.querySelectorAll('.bank-checkbox:checked')].map(cb => parseInt(cb.value));
  const area = document.getElementById('exam-chapter-area');
  const list = document.getElementById('exam-chapter-list');
  if (!area || !list) return;
  if (selectedIds.length === 0) {
    area.style.display = 'none';
    return;
  }
  area.style.display = '';
  try {
    examChapters = await api.getReviewChapters({ bank_ids: selectedIds });
  } catch { examChapters = []; }
  renderExamChapterCheckboxes(examChapters);
}

function renderExamChapterCheckboxes(chapters) {
  const list = document.getElementById('exam-chapter-list');
  const countEl = document.getElementById('exam-chapter-count');
  if (chapters.length === 0) {
    list.innerHTML = '<span class="text-muted">题库中没有章节</span>';
    if (countEl) countEl.textContent = '';
    return;
  }
  list.innerHTML = chapters.map(c =>
    `<label class="d-block chapter-label"><input type="checkbox" class="form-check-input me-1 exam-chapter-filter" value="${escHtml(c)}"> ${escHtml(c)}</label>`
  ).join('');
  updateExamChapterCount();
}

function selectAllExamChapters() {
  document.querySelectorAll('#exam-chapter-list .exam-chapter-filter').forEach(cb => { cb.checked = true; });
  updateExamChapterCount();
}

function deselectAllExamChapters() {
  document.querySelectorAll('#exam-chapter-list .exam-chapter-filter').forEach(cb => { cb.checked = false; });
  updateExamChapterCount();
}

function updateExamChapterCount() {
  const count = document.querySelectorAll('.exam-chapter-filter:checked').length;
  const el = document.getElementById('exam-chapter-count');
  if (el) el.textContent = count > 0 ? `已选 ${count} 个章节` : '';
}

async function startReview() {
  const selectedBanks = [...document.querySelectorAll('.review-bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const types = [...document.querySelectorAll('.review-type-filter:checked')].map(cb => cb.value);
  const chapters = [...document.querySelectorAll('.review-chapter-filter:checked')].map(cb => cb.value);
  const showReviewingOnly = document.getElementById('review-show-reviewing').checked;
  reviewFilter = { bank_ids: selectedBanks, types, chapters: chapters.length > 0 ? chapters : null, show_reviewing_only: showReviewingOnly };
  sessionStorage.setItem('reviewFilter', JSON.stringify(reviewFilter));
  router.navigate('/review');
}

router.add('/review', async () => {
  showNav();
  if (!reviewFilter) {
    const saved = sessionStorage.getItem('reviewFilter');
    if (saved) { reviewFilter = JSON.parse(saved); } else { router.navigate('/review/setup'); return; }
  }
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
    const typeMap = { choice: '选择', multiple: '多选', fill: '填空', judge: '判断' };
    const isKnown = q.review_status === 'known';
    const statusBadge = isKnown
      ? '<span class="badge bg-success">已掌握</span>'
      : '<span class="badge bg-warning text-dark">待复习</span>';
    let optionsHtml = '';
    if (q.type === 'choice' && q.options) {
      try {
        const opts = JSON.parse(q.options);
        const labels = 'ABCDEFGH';
        opts.forEach((opt, i) => {
          const cls = labels[i] === q.answer ? 'review-option review-option-correct' : 'review-option';
          optionsHtml += `<div class="${cls}">${labels[i]}. ${escHtml(opt)}</div>`;
        });
      } catch { /* ignore */ }
    } else if (q.type === 'multiple' && q.options) {
      try {
        const opts = JSON.parse(q.options);
        const labels = 'ABCDEFGH';
        const correctArr = JSON.parse(q.answer);
        opts.forEach((opt, i) => {
          const cls = correctArr.includes(labels[i]) ? 'review-option review-option-correct' : 'review-option';
          optionsHtml += `<div class="${cls}">${labels[i]}. ${escHtml(opt)}</div>`;
        });
      } catch { /* ignore */ }
    } else if (q.type === 'judge') {
      const correct = q.answer === '对' ? 'A' : 'B';
      optionsHtml = ['对', '错'].map((v, i) => {
        const cls = (i === 0 ? 'A' : 'B') === correct ? 'review-option review-option-correct' : 'review-option';
        return `<div class="${cls}">${i === 0 ? 'A' : 'B'}. ${v}</div>`;
      }).join('');
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

function parseAnswerArray(val) {
  if (!val) return [];
  const s = String(val);
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s.replace(/'/g, '"'));
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
  }
  return [s];
}

function renderOptions(options, userAnswer, correctAnswer) {
  if (!options || options.length === 0) return '';
  const labels = 'ABCDEFGH';
  const ua = Array.isArray(userAnswer) ? userAnswer : [String(userAnswer || '')];
  const ca = Array.isArray(correctAnswer) ? correctAnswer : [String(correctAnswer || '')];
  return '<div class="history-options">' + options.map((opt, i) => {
    const letter = labels[i];
    let cls = 'history-option';
    if (ca.includes(letter)) cls += ' option-correct';
    else if (ua.includes(letter)) cls += ' option-wrong';
    return `<div class="${cls}">${letter}. ${escHtml(opt)}</div>`;
  }).join('') + '</div>';
}

function selectMode(el) {
  $$('.mode-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function selectTimerMode(el) {
  $$('[data-timer]').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const mode = el.dataset.timer;
  document.getElementById('per-question-timeouts').style.display = mode === 'per_question' ? '' : 'none';
}

function toggleBankSelect(el) {
  const cb = el.querySelector('.bank-checkbox');
  cb.checked = !cb.checked;
  el.classList.toggle('selected');
  const count = document.querySelectorAll('.bank-checkbox:checked').length;
  document.getElementById('selected-count').textContent = `已选 ${count} 个题库`;
  updateQuestionCount();
  updateExamChapters();
}

async function startExam() {
  const selectedBanks = [...document.querySelectorAll('.bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const mode = document.querySelector('.mode-card.active')?.dataset.mode || 'random';
  const types = [...document.querySelectorAll('.type-filter:checked')].map(cb => cb.value);
  const allQuestions = document.getElementById('question-count-all').checked;
  const questionCount = allQuestions ? null : parseInt(document.getElementById('question-count-input').value) || null;
  const timerMode = document.querySelector('[data-timer].active')?.dataset.timer || 'per_question';
  const choiceTimeout = parseInt(document.getElementById('timeout-choice').value) || 30;
  const fillTimeout = parseInt(document.getElementById('timeout-fill').value) || 60;
  const chapters = [...document.querySelectorAll('.exam-chapter-filter:checked')].map(cb => cb.value);
  try {
    const res = await api.startExam({ bank_ids: selectedBanks, mode, types, chapters: chapters.length > 0 ? chapters : null, question_count: questionCount, timer_mode: timerMode, choice_timeout: choiceTimeout, judge_fill_timeout: fillTimeout });
    examId = res.exam_id;
    examTotalCount = res.total_count;
    examTimerMode = res.timer_mode;
    examStartedAt = res.started_at.endsWith('Z') ? res.started_at : res.started_at + 'Z';
    examElapsedOffset = 0;
    examCurrentIndex = 0;
    sessionStorage.removeItem('examCurrentIndex');
    sessionStorage.setItem('activeExamId', examId);
    sessionStorage.setItem('examTimerMode', examTimerMode);
    sessionStorage.setItem('examStartedAt', examStartedAt);
    sessionStorage.setItem('examElapsedOffset', '0');
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
  sessionStorage.setItem('examCurrentIndex', index);
  if (examFullPreview) {
    examCurrentIndex = index;
    renderQuestionGrid();
    const el = document.querySelector(`.preview-card[data-index="${index}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  } else {
    loadQuestionByIndex(index);
  }
}

async function loadQuestionByIndex(index) {
  if (examTimerInterval) clearInterval(examTimerInterval);
  if (!examId) return;
  sessionStorage.setItem('examCurrentIndex', index);
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

    const typeMap = { choice: '选择题', multiple: '多选题', fill: '填空题', judge: '判断题' };
    const q = data.question;

    if (data.is_answered) {
      const icon = data.is_correct ? '<span class="text-success">\u2713</span>' : '<span class="text-danger">\u2717</span>';
      const feedbackClass = data.is_correct ? 'feedback-correct' : 'feedback-wrong';
      if (examTimerMode !== 'elapsed') {
        document.getElementById('exam-timer').textContent = '';
      }

      let answeredOptionsHtml = '';
      if (q.type === 'choice' || q.type === 'multiple') {
        const opts = JSON.parse(q.options || '[]');
        const labels = 'ABCDEFGH';
        const ua = parseAnswerArray(data.user_answer);
        const ca = parseAnswerArray(data.correct_answer);
        answeredOptionsHtml = '<div class="history-options">' + opts.map((opt, i) => {
          const letter = labels[i];
          let cls = 'history-option';
          if (ca.includes(letter)) cls += ' option-correct';
          else if (ua.includes(letter)) cls += ' option-wrong';
          return `<div class="${cls}">${letter}. ${escHtml(opt)}</div>`;
        }).join('') + '</div>';
      }

      document.getElementById('exam-content').innerHTML = `
        <div class="exam-question">
          <div class="mb-3">
            <span class="badge bg-primary me-2">${typeMap[q.type] || q.type}</span>
            ${q.chapter ? `<span class="badge bg-secondary">${escHtml(q.chapter)}</span>` : ''}
          </div>
          <h4 class="mb-4">${escHtml(q.content)}</h4>
          ${answeredOptionsHtml}
          <div class="feedback ${feedbackClass}">
            <h3>${icon} ${data.is_correct ? '回答正确！' : '回答错误'}</h3>
            <p class="mb-1">你的答案: <strong class="${data.is_correct ? 'text-success' : 'text-danger'}">${escHtml(data.user_answer || '(未作答)')}</strong></p>
            <p class="mb-1">正确答案: <strong>${escHtml(data.correct_answer)}</strong></p>
            ${q.analysis ? `<div class="analysis-box">📖 ${escHtml(q.analysis)}</div>` : ''}
          </div>
        </div>
      `;
      return;
    }

    const isChoice = q.type === 'choice';
    const isMultiple = q.type === 'multiple';
    if (examTimerMode !== 'elapsed') {
      examTimeoutSeconds = isChoice
        ? (parseInt(document.getElementById('timeout-choice')?.value) || 30)
        : (isMultiple
          ? (parseInt(document.getElementById('timeout-multi')?.value) || 45)
          : (parseInt(document.getElementById('timeout-fill')?.value) || 60));
      state.questionStartTime = Date.now();
    }

    let optionsHtml = '';
    if (q.type === 'choice') {
      const opts = JSON.parse(q.options || '[]');
      opts.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        optionsHtml += `<div class="choice-option" onclick="selectChoice(this, '${letter}')">${escHtml(opt)}</div>`;
      });
    } else if (q.type === 'multiple') {
      const opts = JSON.parse(q.options || '[]');
      opts.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        optionsHtml += `<div class="choice-option" onclick="toggleMultiChoice(this, '${letter}')">${escHtml(opt)}</div>`;
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
    } else if (q.type === 'multiple') {
      selectedMultiAnswers = [];
      document.getElementById('submit-answer-btn').disabled = true;
    } else {
      selectedAnswer = null;
    }

    if (examTimerMode !== 'elapsed') {
      startTimer();
    }
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
  if (examTimerMode === 'elapsed') {
    clearInterval(examElapsedInterval);
    examElapsedInterval = null;
    const timerEl = document.getElementById('exam-timer');
    if (timerEl) {
      examPauseRemaining = parseTime(timerEl.textContent);
      examElapsedOffset = examPauseRemaining;
      sessionStorage.setItem('examElapsedOffset', examElapsedOffset);
    }
  } else {
    const timerEl = document.getElementById('exam-timer');
    examPauseRemaining = parseTime(timerEl.textContent);
  }
  document.getElementById('exam-pause-overlay').classList.remove('d-none');
}

function resumeExam() {
  if (!examPaused) return;
  examPaused = false;
  document.getElementById('exam-pause-overlay').classList.add('d-none');
  if (examTimerMode === 'elapsed') {
    examStartedAt = new Date().toISOString();
    sessionStorage.setItem('examStartedAt', examStartedAt);
    startElapsedTimer();
  } else {
    startTimer(examPauseRemaining);
  }
}

async function finishExam() {
  if (!confirm('确定要提前结束吗？未答的题目将计为错误。')) return;
  if (examPaused) resumeExam();
  clearInterval(examTimerInterval);
  if (examElapsedInterval) clearInterval(examElapsedInterval);
  try {
    await api.finishExam(examId);
    window.removeEventListener('scroll', trackPreviewScroll);
    sessionStorage.removeItem('activeExamId');
    sessionStorage.removeItem('examCurrentIndex');
    sessionStorage.removeItem('examMode');
    sessionStorage.removeItem('examTimerMode');
    sessionStorage.removeItem('examStartedAt');
    sessionStorage.removeItem('examElapsedOffset');
    document.removeEventListener('keydown', examKeyHandler);
    router.navigate(`/result/${examId}`);
  } catch (err) {
    alert('结束失败: ' + err.message);
  }
}

function parseTime(str) {
  // ponytail: 仅接受 M:SS 整数格式，空串/异常格式返回 0，避免 parseInt(undefined)→NaN 导致暂停恢复崩溃
  const m = /^(\d+):(\d+)$/.exec(String(str || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function trackPreviewScroll() {
  if (examScrollTimer) clearTimeout(examScrollTimer);
  examScrollTimer = setTimeout(() => {
    const cards = document.querySelectorAll('.preview-card');
    if (!cards.length) return;
    let nearest = 0, minDist = Infinity;
    cards.forEach(card => {
      const dist = Math.abs(card.getBoundingClientRect().top - 80);
      if (dist < minDist) { minDist = dist; nearest = parseInt(card.dataset.index); }
    });
    if (nearest !== examCurrentIndex) {
      examCurrentIndex = nearest;
      sessionStorage.setItem('examCurrentIndex', nearest);
      renderQuestionGrid();
    }
  }, 150);
}

function startElapsedTimer() {
  if (examElapsedInterval) clearInterval(examElapsedInterval);
  if (!examStartedAt) examStartedAt = new Date().toISOString();
  const start = new Date(examStartedAt).getTime();
  const update = () => {
    const elapsed = examElapsedOffset + Math.floor((Date.now() - start) / 1000);
    if (examTimerMode === 'elapsed') {
      const timerEl = document.getElementById('exam-timer');
      if (timerEl) {
        timerEl.textContent = formatTime(elapsed);
        timerEl.className = 'exam-timer';
      }
      const elEl = document.getElementById('exam-elapsed');
      if (elEl) elEl.classList.add('d-none');
    } else {
      const el = document.getElementById('exam-elapsed');
      if (el) {
        el.textContent = '总 ' + formatTime(elapsed);
        el.classList.remove('d-none');
      }
    }
  };
  update();
  examElapsedInterval = setInterval(update, 1000);
}

async function toggleExamMode() {
  examFullPreview = !examFullPreview;
  sessionStorage.setItem('examMode', examFullPreview ? 'preview' : 'single');
  const btn = document.getElementById('mode-toggle-btn');
  if (examFullPreview) {
    // 进入整卷模式：停止单题倒计时，避免归零后后台自动提交当前题（#52）
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    btn.textContent = '📖 单题模式';
    document.querySelector('.exam-layout')?.classList.add('exam-layout-preview');
    document.getElementById('prev-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('exam-nav-hint').style.display = 'none';
    if (examTimerMode === 'per_question') document.getElementById('exam-timer').style.display = 'none';
    document.querySelector('.exam-progress').style.display = 'none';
    document.getElementById('exam-progress-text').textContent = '整卷模式';
    await renderFullPreview();
    const scrollEl = document.querySelector(`.preview-card[data-index="${examCurrentIndex}"]`);
    if (scrollEl) {
      const top = scrollEl.getBoundingClientRect().top + window.scrollY - 80;
      setTimeout(() => window.scrollTo({ top, behavior: 'smooth' }), 50);
    }
    window.addEventListener('scroll', trackPreviewScroll, { passive: true });
  } else {
    btn.textContent = '📋 整卷模式';
    window.removeEventListener('scroll', trackPreviewScroll);
    document.querySelector('.exam-layout')?.classList.remove('exam-layout-preview');
    document.getElementById('prev-btn').style.display = '';
    document.getElementById('next-btn').style.display = '';
    document.getElementById('exam-nav-hint').style.display = '';
    document.getElementById('exam-timer').style.display = '';
    document.querySelector('.exam-progress').style.display = '';
    document.getElementById('exam-progress-text').textContent = `第 ${examCurrentIndex + 1}/${examTotalCount} 题`;
    if (examTimerMode === 'elapsed' && !examElapsedInterval) startElapsedTimer();
    loadQuestionByIndex(examCurrentIndex);
  }
}

async function renderFullPreview() {
  document.getElementById('exam-content').innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
  try {
    const data = await api.getExamPreview(examId);
    examTotalCount = data.total_count;
    examProgress = { total_count: data.total_count, answers: data.questions.filter(q => q.is_answered).map(q => ({ index: q.index, is_correct: q.is_correct })) };
    renderQuestionGrid();
    let html = '<div class="full-preview">';
    const typeMap = { choice: '选择题', multiple: '多选题', fill: '填空题', judge: '判断题' };
    data.questions.forEach((q) => {
      const statusCls = q.is_answered ? (q.is_correct ? 'preview-card-correct' : 'preview-card-wrong') : 'preview-card-empty';
      const statusText = q.is_answered ? (q.is_correct ? '✓ 正确' : '✗ 错误') : '未作答';
      let optionsHtml = '';
      if (q.type === 'choice' && q.options) {
        const labels = 'ABCDEFGH';
        q.options.forEach((opt, i) => {
          const letter = labels[i];
          let cls = 'preview-option';
          if (q.is_answered) {
            if (letter === q.answer) cls += ' preview-option-correct';
            else if (letter === q.user_answer) cls += ' preview-option-wrong';
          }
          optionsHtml += `<div class="${cls}" onclick="submitInlineChoice(${examId}, ${q.id}, ${q.index}, '${letter}')" ${q.is_answered ? '' : 'style="cursor:pointer"'}>${letter}. ${escHtml(opt)}</div>`;
        });
      } else if (q.type === 'judge') {
        if (q.is_answered) {
          const labels = { '对': 'A', '错': 'B' };
          ['对', '错'].forEach(v => {
            const letter = labels[v];
            let cls = 'preview-option';
            if (v === q.answer) cls += ' preview-option-correct';
            else if (v === q.user_answer) cls += ' preview-option-wrong';
            optionsHtml += `<div class="${cls}">${letter}. ${v}</div>`;
          });
        } else {
          optionsHtml = `
            <div class="preview-option" style="cursor:pointer" onclick="submitInlineAnswer(${examId}, ${q.id}, ${q.index}, '\u5bf9')">A. 对</div>
            <div class="preview-option" style="cursor:pointer" onclick="submitInlineAnswer(${examId}, ${q.id}, ${q.index}, '\u9519')">B. 错</div>
          `;
        }
      } else if (q.type === 'multiple' && q.options) {
        const labels = 'ABCDEFGH';
        if (q.is_answered) {
          const ca = Array.isArray(q.answer) ? q.answer : [q.answer];
          const ua = Array.isArray(q.user_answer) ? q.user_answer : [q.user_answer];
          q.options.forEach((opt, i) => {
            const letter = labels[i];
            let cls = 'preview-option';
            if (ca.includes(letter)) cls += ' preview-option-correct';
            else if (ua.includes(letter)) cls += ' preview-option-wrong';
            optionsHtml += `<div class="${cls}">${letter}. ${escHtml(opt)}</div>`;
          });
        } else {
          q.options.forEach((opt, i) => {
            const letter = labels[i];
            optionsHtml += `<div class="preview-option preview-multi-option" data-letter="${letter}" onclick="togglePreviewMulti(this)" style="cursor:pointer">${letter}. ${escHtml(opt)}</div>`;
          });
          optionsHtml += `<button class="btn btn-primary btn-sm mt-2" onclick="submitInlineMulti(${examId}, ${q.id}, ${q.index})">提交</button>`;
        }
      } else if (q.type === 'fill' && !q.is_answered) {
        const multi = Array.isArray(q.answer) && q.answer.length > 1;
        if (multi) {
          optionsHtml = `<div class="d-flex flex-wrap gap-2 mt-2 justify-content-center">`;
          q.answer.forEach((_, i) => {
            optionsHtml += `<input type="text" class="form-control preview-fill-input" id="preview-fill-${q.id}-${i}" data-qid="${q.id}" data-idx="${i}" placeholder="空 ${i + 1}">`;
          });
          optionsHtml += `</div><button class="btn btn-primary btn-sm mt-2" onclick="submitInlineFill(${examId}, ${q.id}, ${q.index})">提交</button>`;
        } else {
          optionsHtml = `<div class="d-flex gap-2 mt-2 justify-content-center"><input type="text" class="form-control preview-fill-input" id="preview-fill-${q.id}-0" data-qid="${q.id}" data-idx="0" placeholder="请输入答案"><button class="btn btn-primary btn-sm" onclick="submitInlineFill(${examId}, ${q.id}, ${q.index})">提交</button></div>`;
        }
      }
      if (q.type === 'fill' && q.is_answered) {
        const userAns = Array.isArray(q.user_answer) ? q.user_answer.join(', ') : q.user_answer;
        const correctAns = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer;
        optionsHtml = `<div class="text-muted small mt-1">你的答案: <span class="${q.is_correct ? 'text-success' : 'text-danger'}">${escHtml(userAns)}</span> | 正确答案: <span class="text-success">${escHtml(correctAns)}</span></div>`;
      }
      html += `
        <div class="preview-card ${statusCls}" data-index="${q.index}">
          <div class="preview-card-header">
            <span class="preview-card-num">第 ${q.index + 1} 题</span>
            <span class="badge bg-primary me-1">${typeMap[q.type] || q.type}</span>
            ${q.chapter ? `<span class="badge bg-secondary">${escHtml(q.chapter)}</span>` : ''}
            <span class="preview-card-status ${q.is_answered ? (q.is_correct ? 'text-success' : 'text-danger') : 'text-muted'}">${statusText}</span>
          </div>
          <div class="preview-card-body">${escHtml(q.content)}</div>
          ${optionsHtml ? `<div class="preview-card-options">${optionsHtml}</div>` : ''}
          ${q.is_answered && q.analysis ? `<div class="preview-card-analysis ${q.is_correct ? 'preview-card-analysis-correct' : 'preview-card-analysis-wrong'}">📖 ${escHtml(q.analysis)}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';
    document.getElementById('exam-content').innerHTML = html;
  } catch {
    document.getElementById('exam-content').innerHTML = '<div class="alert alert-danger">加载失败</div>';
  }
}

async function submitInlineAnswer(examId, questionId, index, answer) {
  if (examPaused) return;
  const timeSpent = 1;
  try {
    const res = await api.submitAnswer(examId, questionId, answer, timeSpent);
    examCurrentIndex = index;
    sessionStorage.setItem('examCurrentIndex', index);
    examProgress = await api.getExamProgress(examId);
    renderQuestionGrid();
    updatePreviewCard(index, questionId, res.is_correct, res.correct_answer, answer, res.analysis);
  } catch (err) {
    alert('提交失败: ' + err.message);
  }
}

function updatePreviewCard(index, questionId, isCorrect, correctAnswer, userAnswer, analysis) {
  const card = document.querySelector(`.preview-card[data-index="${index}"]`);
  if (!card) return;
  card.classList.remove('preview-card-empty');
  card.classList.add(isCorrect ? 'preview-card-correct' : 'preview-card-wrong');

  const status = card.querySelector('.preview-card-status');
  if (status) {
    status.className = `preview-card-status ${isCorrect ? 'text-success' : 'text-danger'}`;
    status.textContent = isCorrect ? '✓ 正确' : '✗ 错误';
  }

  const optionsDiv = card.querySelector('.preview-card-options');
  if (!optionsDiv) return;
  const questionData = card.querySelector('.preview-card-body');
  const type = card.querySelector('.badge.bg-primary');
  const typeText = type ? type.textContent.trim() : '';
  let newOptionsHtml = '';

  if (typeText === '选择题' || typeText === 'choice') {
    const options = optionsDiv.querySelectorAll('.preview-option');
    const labels = 'ABCDEFGH';
    const ca = String(correctAnswer || '');
    const ua = String(userAnswer || '');
    newOptionsHtml = '';
    options.forEach((opt, i) => {
      const letter = labels[i];
      let cls = 'preview-option';
      if (letter === ca) cls += ' preview-option-correct';
      else if (letter === ua) cls += ' preview-option-wrong';
      const text = opt.textContent.replace(/^[A-Z]\.\s*/, '');
      newOptionsHtml += `<div class="${cls}">${letter}. ${escHtml(text.trim())}</div>`;
    });
  } else if (typeText === '多选题' || typeText === 'multiple') {
    const labels = 'ABCDEFGH';
    const ca = Array.isArray(correctAnswer) ? correctAnswer : [String(correctAnswer || '')];
    const ua = Array.isArray(userAnswer) ? userAnswer : [String(userAnswer || '')];
    const options = optionsDiv.querySelectorAll('.preview-option');
    newOptionsHtml = '';
    options.forEach((opt, i) => {
      const letter = labels[i];
      let cls = 'preview-option';
      if (ca.includes(letter)) cls += ' preview-option-correct';
      else if (ua.includes(letter)) cls += ' preview-option-wrong';
      const text = opt.textContent.replace(/^[A-Z]\.\s*/, '');
      newOptionsHtml += `<div class="${cls}">${letter}. ${escHtml(text.trim())}</div>`;
    });
  } else if (typeText === '判断题' || typeText === 'judge') {
    const labels = { '对': 'A', '错': 'B' };
    const ca = String(correctAnswer || '');
    const ua = String(userAnswer || '');
    newOptionsHtml = ['对', '错'].map(v => {
      const letter = labels[v];
      let cls = 'preview-option';
      if (v === ca) cls += ' preview-option-correct';
      else if (v === ua) cls += ' preview-option-wrong';
      return `<div class="${cls}">${letter}. ${v}</div>`;
    }).join('');
  } else {
    const userAns = Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer || '';
    const correctAns = Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer || '';
    newOptionsHtml = `<div class="text-muted small mt-1">你的答案: <span class="${isCorrect ? 'text-success' : 'text-danger'}">${escHtml(userAns)}</span> | 正确答案: <span class="text-success">${escHtml(correctAns)}</span></div>`;
  }

  optionsDiv.innerHTML = newOptionsHtml;

  const existingAnalysis = card.querySelector('.preview-card-analysis');
  if (existingAnalysis) existingAnalysis.remove();
  if (analysis) {
    const analysisDiv = document.createElement('div');
    analysisDiv.className = `preview-card-analysis ${isCorrect ? 'preview-card-analysis-correct' : 'preview-card-analysis-wrong'}`;
    analysisDiv.textContent = '📖 ' + analysis;
    card.appendChild(analysisDiv);
  }
}

function submitInlineChoice(examId, questionId, index, answer) {
  submitInlineAnswer(examId, questionId, index, answer);
}

async function submitInlineFill(examId, questionId, index) {
  if (examPaused) return;
  const inputs = document.querySelectorAll(`.preview-fill-input[data-qid="${questionId}"]`);
  let answer = null;
  if (inputs.length === 1) {
    answer = inputs[0].value.trim() || null;
  } else {
    answer = [...inputs].map(inp => inp.value.trim()).filter(v => v !== '');
    if (answer.length === 0) answer = null;
  }
  if (!answer) { alert('请先输入答案'); return; }
  await submitInlineAnswer(examId, questionId, index, answer);
}

function togglePreviewMulti(el) {
  el.classList.toggle('selected');
}

async function submitInlineMulti(examId, questionId, index) {
  if (examPaused) return;
  // 仅在当前题目卡片内选取已选选项，避免整卷模式下其他多选题的选择被一并提交
  const card = document.querySelector(`.preview-card[data-index="${index}"]`);
  const selected = card ? [...card.querySelectorAll('.preview-multi-option.selected')].map(el => el.dataset.letter) : [];
  if (selected.length === 0) { alert('请至少选择一个选项'); return; }
  await submitInlineAnswer(examId, questionId, index, selected);
}

function selectChoice(el, value) {
  $$('.choice-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAnswer = value;
  document.getElementById('submit-answer-btn').disabled = false;
}

function toggleMultiChoice(el, value) {
  el.classList.toggle('selected');
  const idx = selectedMultiAnswers.indexOf(value);
  if (idx === -1) {
    selectedMultiAnswers.push(value);
  } else {
    selectedMultiAnswers.splice(idx, 1);
  }
  document.getElementById('submit-answer-btn').disabled = selectedMultiAnswers.length === 0;
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
  // ponytail: 负数或非有限值钳为 0，防止倒计时越界后显示 "-1:-1"
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function submitCurrentAnswer() {
  if (!examId) return;
  clearInterval(examTimerInterval);
  const btn = document.getElementById('submit-answer-btn');
  if (btn) btn.disabled = true;

  const timeSpent = examTimerMode === 'elapsed' ? 0 : Math.max(1, Math.floor((Date.now() - state.questionStartTime) / 1000));

  let userAnswer = selectedAnswer || null;
  if (selectedMultiAnswers.length > 0) {
    userAnswer = [...selectedMultiAnswers];
    selectedMultiAnswers = [];
  }
  // 仅在单题模式下从当前题目的输入区读取填空答案，避免整卷模式或 DOM 残留元素覆盖其他题型的选择
  const optionsArea = document.getElementById('options-area');
  if (optionsArea) {
    const fillInputs = optionsArea.querySelectorAll('.fill-input');
    if (fillInputs.length > 0) {
      userAnswer = [...fillInputs].map(inp => inp.value.trim()).filter(v => v !== '');
      if (userAnswer.length === 0) userAnswer = null;
      else if (userAnswer.length === 1) userAnswer = userAnswer[0];
    }
    const singleFill = optionsArea.querySelector('#fill-answer');
    if (singleFill) userAnswer = singleFill.value.trim() || null;
  }

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
    preview.innerHTML = `<div class="alert alert-danger">导入失败: ${escHtml(err.message)}</div>`;
    btn.disabled = false; btn.innerHTML = '确认导入';
  }
}

function downloadSample() {
  const sample = {
    title: "示例题库",
    description: "这是一个示例题库",
    questions: [
      { type: "choice", chapter: "第一章 基础", content: "中国的首都是？", options: ["上海", "北京", "广州", "深圳"], answer: "B", analysis: "北京是中国的首都。" },
      { type: "multiple", chapter: "第一章 基础", content: "以下哪些是中国的直辖市？", options: ["北京", "上海", "广州", "重庆"], answer: ["A", "B", "D"], analysis: "中国的直辖市有北京、上海、天津、重庆。" },
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

function confirmDeleteBank(id) {
  const card = document.querySelector(`[data-bank-id="${id}"]`)?.closest('.card');
  const title = card ? card.querySelector('.card-title')?.textContent : '(未知)';
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

let _deleteBankId = null;
let _deleteQuestionId = null;

function showAddQuestion(bankId) {
  document.getElementById('qform-bank-id').value = bankId;
  document.getElementById('qform-question-id').value = '';
  document.getElementById('qform-title').textContent = '新增题目';
  document.getElementById('qform-save-btn').textContent = '新增';
  document.getElementById('qform-type').value = 'choice';
  document.getElementById('qform-chapter').value = '';
  document.getElementById('qform-content').value = '';
  document.getElementById('qform-options').value = '';
  document.getElementById('qform-analysis').value = '';
  document.getElementById('qform-options-group').style.display = 'block';
  onQFormTypeChange();
  new bootstrap.Modal(document.getElementById('questionFormModal')).show();
}

async function showEditQuestion(bankId, questionId) {
  try {
    const bank = await api.getBank(bankId);
    const q = bank.questions.find(x => x.id === questionId);
    if (!q) { alert('题目不存在'); return; }
    document.getElementById('qform-bank-id').value = bankId;
    document.getElementById('qform-question-id').value = questionId;
    document.getElementById('qform-title').textContent = '编辑题目';
    document.getElementById('qform-save-btn').textContent = '保存';
    document.getElementById('qform-type').value = q.type;
    document.getElementById('qform-chapter').value = q.chapter || '';
    document.getElementById('qform-content').value = q.content;
    let optionsStr = '';
    if (q.options) {
      try { const opts = JSON.parse(q.options); optionsStr = opts.join('\n'); } catch { optionsStr = q.options; }
    }
    document.getElementById('qform-options').value = optionsStr;
    document.getElementById('qform-analysis').value = q.analysis || '';
    const isChoiceOrMulti = q.type === 'choice' || q.type === 'multiple';
    document.getElementById('qform-options-group').style.display = isChoiceOrMulti ? 'block' : 'none';
    onQFormTypeChange();
    setTimeout(() => {
      const answerData = q.answer;
      if (q.type === 'choice') {
        const radios = document.querySelectorAll('input[name="qform-choice"]');
        radios.forEach(r => { if (r.value === answerData) r.checked = true; });
      } else if (q.type === 'multiple') {
        let ansArr = [];
        try { ansArr = JSON.parse(answerData); } catch { ansArr = []; }
        document.querySelectorAll('input[name="qform-multi"]').forEach(cb => { cb.checked = ansArr.includes(cb.value); });
      } else if (q.type === 'fill') {
        let fillVal = answerData;
        try { const parsed = JSON.parse(answerData); if (Array.isArray(parsed)) fillVal = parsed.join('||'); } catch { }
        const inp = document.getElementById('qform-fill-answer');
        if (inp) inp.value = fillVal;
      } else if (q.type === 'judge') {
        const radios = document.querySelectorAll('input[name="qform-judge"]');
        radios.forEach(r => { if (r.value === answerData) r.checked = true; });
      }
    }, 50);
    new bootstrap.Modal(document.getElementById('questionFormModal')).show();
  } catch (err) {
    alert('加载题目失败: ' + err.message);
  }
}

function showDeleteQuestion(bankId, questionId) {
  _deleteBankId = bankId;
  _deleteQuestionId = questionId;
  document.getElementById('delete-confirm-msg').textContent = '确定删除这道题目吗？该操作不可恢复。';
  new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

async function doDeleteQuestion() {
  if (!_deleteQuestionId) return;
  const qid = _deleteQuestionId;
  _deleteQuestionId = null;
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  try {
    await api.deleteQuestion(qid);
    bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
    router.resolve();
  } catch (err) {
    alert('删除失败: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function onQFormTypeChange() {
  const type = document.getElementById('qform-type').value;
  const optionsGroup = document.getElementById('qform-options-group');
  const answerGroup = document.getElementById('qform-answer-group');
  if (type === 'choice' || type === 'multiple') {
    optionsGroup.style.display = 'block';
  } else {
    optionsGroup.style.display = 'none';
  }
  if (type === 'choice') {
    const optsText = document.getElementById('qform-options').value;
    const lines = optsText.split('\n').filter(l => l.trim());
    answerGroup.innerHTML = lines.map((line, i) => {
      const letter = String.fromCharCode(65 + i);
      return `<div class="form-check">
        <input class="form-check-input" type="radio" name="qform-choice" id="qc-${letter}" value="${letter}">
        <label class="form-check-label" for="qc-${letter}">${escHtml(line.trim())}</label>
      </div>`;
    }).join('') || '<div class="text-muted small">请先在"选项"中输入内容</div>';
  } else if (type === 'multiple') {
    const optsText = document.getElementById('qform-options').value;
    const lines = optsText.split('\n').filter(l => l.trim());
    answerGroup.innerHTML = lines.map((line, i) => {
      const letter = String.fromCharCode(65 + i);
      return `<div class="form-check">
        <input class="form-check-input" type="checkbox" name="qform-multi" id="qm-${letter}" value="${letter}">
        <label class="form-check-label" for="qm-${letter}">${escHtml(line.trim())}</label>
      </div>`;
    }).join('') || '<div class="text-muted small">请先在"选项"中输入内容</div>';
  } else if (type === 'fill') {
    answerGroup.innerHTML = `<input type="text" class="form-control" id="qform-fill-answer" placeholder="填空答案（多空用 || 分隔）">`;
  } else if (type === 'judge') {
    answerGroup.innerHTML = `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="radio" name="qform-judge" id="qj-true" value="对">
        <label class="form-check-label" for="qj-true">对</label>
      </div>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="radio" name="qform-judge" id="qj-false" value="错">
        <label class="form-check-label" for="qj-false">错</label>
      </div>`;
  }
}

async function saveQForm() {
  const bankId = parseInt(document.getElementById('qform-bank-id').value);
  const questionId = document.getElementById('qform-question-id').value;
  const isEdit = !!questionId;
  const type = document.getElementById('qform-type').value;
  const chapter = document.getElementById('qform-chapter').value || null;
  const content = document.getElementById('qform-content').value;
  const optionsText = document.getElementById('qform-options').value;
  const analysis = document.getElementById('qform-analysis').value || null;

  if (!content.trim()) { alert('请输入题目内容'); return; }

  let options = null;
  if (type === 'choice' || type === 'multiple') {
    options = optionsText.split('\n').map(l => l.replace(/^[A-Z]\.\s*/, '').trim()).filter(Boolean);
    if (options.length < 2) { alert(`${type === 'choice' ? '选择' : '多选'}题至少需要 2 个选项`); return; }
  }

  let answer;
  if (type === 'choice') {
    const selected = document.querySelector('input[name="qform-choice"]:checked');
    if (!selected) { alert('请选择正确答案'); return; }
    answer = selected.value;
  } else if (type === 'multiple') {
    const checked = document.querySelectorAll('input[name="qform-multi"]:checked');
    if (checked.length === 0) { alert('请至少选择一个正确答案'); return; }
    answer = Array.from(checked).map(cb => cb.value);
  } else if (type === 'fill') {
    const val = document.getElementById('qform-fill-answer').value;
    if (!val.trim()) { alert('请输入答案'); return; }
    if (val.includes('||')) {
      answer = val.split('||').map(s => s.trim());
    } else {
      answer = val.trim();
    }
  } else if (type === 'judge') {
    const selected = document.querySelector('input[name="qform-judge"]:checked');
    if (!selected) { alert('请选择正确答案'); return; }
    answer = selected.value;
  }

  const data = { type, chapter, content, options, answer, analysis };

  const btn = document.getElementById('qform-save-btn');
  btn.disabled = true;
  try {
    if (isEdit) {
      await api.updateQuestion(parseInt(questionId), data);
    } else {
      await api.createQuestion(bankId, data);
    }
    bootstrap.Modal.getInstance(document.getElementById('questionFormModal')).hide();
    router.resolve();
  } catch (err) {
    alert('保存失败: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function showBankEditModal(bankId) {
  try {
    const bank = await api.getBank(bankId);
    document.getElementById('bankedit-id').value = bankId;
    document.getElementById('bankedit-title').value = bank.title;
    document.getElementById('bankedit-description').value = bank.description || '';
    new bootstrap.Modal(document.getElementById('bankEditModal')).show();
  } catch (err) {
    alert('加载题库信息失败: ' + err.message);
  }
}

async function saveBankEdit() {
  const bankId = parseInt(document.getElementById('bankedit-id').value);
  const title = document.getElementById('bankedit-title').value;
  const description = document.getElementById('bankedit-description').value;
  if (!title.trim()) { alert('题库标题不能为空'); return; }
  try {
    await api.updateBank(bankId, { title, description: description || null });
    bootstrap.Modal.getInstance(document.getElementById('bankEditModal')).hide();
    router.resolve();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function init() {
  const savedExamId = sessionStorage.getItem('activeExamId');
  if (savedExamId) examId = parseInt(savedExamId);
  const savedFilter = sessionStorage.getItem('reviewFilter');
  if (savedFilter) reviewFilter = JSON.parse(savedFilter);
  const savedMode = sessionStorage.getItem('examMode');
  if (savedMode) examFullPreview = savedMode === 'preview';
  const savedIdx = sessionStorage.getItem('examCurrentIndex');
  if (savedIdx) examCurrentIndex = parseInt(savedIdx);
  examTimerMode = sessionStorage.getItem('examTimerMode') || 'per_question';
  examStartedAt = sessionStorage.getItem('examStartedAt') || null;
  examElapsedOffset = parseInt(sessionStorage.getItem('examElapsedOffset')) || 0;
  const authed = await checkAuth();
  if (!authed && !location.hash.match(/^\#\/(login|register)$/)) {
    router.navigate('/login');
  }
  router.resolve();
}

// ── 错题练习弹窗 ──

async function openWrongPracticeModal() {
  const banks = await api.getBanks();
  const wrongs = await api.getWrongAnswers();
  const wrongBankTitles = new Set(wrongs.map(w => w.bank_title));

  let bankCheckboxes = '';
  banks.forEach(b => {
    const checked = wrongBankTitles.has(b.title) ? 'checked' : '';
    bankCheckboxes += `
      <div class="col-md-4 col-6">
        <div class="bank-check-card">
          <div class="form-check">
            <input type="checkbox" class="form-check-input wrong-practice-bank" value="${b.id}" ${checked}>
            <label class="form-check-label">${escHtml(b.title)} <span class="text-muted">(${b.question_count} 题)</span></label>
          </div>
        </div>
      </div>`;
  });

  const modalHtml = `
    <div class="modal fade show d-block" id="wrong-practice-modal" tabindex="-1" style="background:rgba(0,0,0,0.5)">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">错题练习设置</h5>
            <button type="button" class="btn-close" onclick="closeWrongPracticeModal()"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted">选择要练习的题库（默认全选有错题的题库），将使用现有答题流程进行练习。</p>
            <div id="wrong-practice-bank-select" class="row g-2">
              ${bankCheckboxes}
            </div>
            <div class="mt-3">
              <button class="btn btn-sm btn-link" onclick="document.querySelectorAll('.wrong-practice-bank').forEach(cb=>cb.checked=true)">全选</button>
              <button class="btn btn-sm btn-link" onclick="document.querySelectorAll('.wrong-practice-bank').forEach(cb=>cb.checked=false)">取消全选</button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeWrongPracticeModal()">取消</button>
            <button type="button" class="btn btn-warning" id="wrong-practice-start-btn" onclick="startWrongPractice()">开始练习</button>
          </div>
        </div>
      </div>
    </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'wrong-practice-overlay';
  overlay.innerHTML = modalHtml;
  document.body.appendChild(overlay);
}

function closeWrongPracticeModal() {
  const overlay = document.getElementById('wrong-practice-overlay');
  if (overlay) overlay.remove();
}

async function startWrongPractice() {
  const selectedBanks = [...document.querySelectorAll('.wrong-practice-bank:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const btn = document.getElementById('wrong-practice-start-btn');
  btn.disabled = true;
  btn.textContent = '创建中...';
  try {
    const res = await api.startWrongAnswerExam({
      bank_ids: selectedBanks,
      timer_mode: 'per_question',
    });
    examId = res.exam_id;
    examTotalCount = res.total_count;
    examTimerMode = 'per_question';
    examStartedAt = new Date().toISOString();
    examElapsedOffset = 0;
    examCurrentIndex = 0;
    sessionStorage.removeItem('examCurrentIndex');
    sessionStorage.setItem('activeExamId', examId);
    sessionStorage.setItem('examTimerMode', examTimerMode);
    sessionStorage.setItem('examStartedAt', examStartedAt);
    sessionStorage.setItem('examElapsedOffset', '0');
    closeWrongPracticeModal();
    router.navigate('/exam');
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.textContent = '开始练习';
  }
}

document.addEventListener('DOMContentLoaded', init);
