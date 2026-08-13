const API_BASE = '/api';
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me'];

function _isAuthPath(path) {
  return AUTH_PATHS.some(p => path === p || path.startsWith(p + '?'));
}

function _handle401(path) {
  if (_isAuthPath(path)) return;
  api.setToken(null);
  window.dispatchEvent(new CustomEvent('auth-expired'));
}

const api = {
  token: localStorage.getItem('token'),

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const opts = { method, headers };
    if (body !== null) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 204) return null;
    // 网关 502/504 HTML 错误页、500 空 body 不是 JSON：解析失败不抛 SyntaxError，
    // 统一落到带状态码的可读错误，保住调用点对 err.status 的分支判断（issue #157）
    let data;
    try { data = await res.json(); } catch { data = undefined; }
    if (!res.ok) {
      if (res.status === 401) _handle401(path);
      const msg = res.status === 429
        ? '请求过于频繁，请稍后重试'
        : ((data && (data.detail || data.error)) || `请求失败(${res.status})`);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (data === undefined) {
      const err = new Error(`响应解析失败(${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  delete(path) { return this.request('DELETE', path); },

  register(username, password) { return this.post('/auth/register', { username, password }); },
  login(username, password) { return this.post('/auth/login', { username, password }); },
  me() { return this.get('/auth/me'); },

  getBanks() { return this.get('/question-banks'); },
  getBank(id) { return this.get(`/question-banks/${id}`); },
  importBank(data) { return this.post('/question-banks/import', data); },
  importBanksMultiple(dataList) { return this.post('/question-banks/import-multiple', dataList); },
  deleteBank(id) { return this.delete(`/question-banks/${id}`); },

  startExam(data) { return this.post('/exam/start', data); },
  getUnfinishedExams() { return this.get('/exam/unfinished'); },
  getExamProgress(examId) { return this.get(`/exam/${examId}/progress`); },
  getCurrentQuestion(examId, index = null) {
    const path = index !== null ? `/exam/${examId}/current?index=${index}` : `/exam/${examId}/current`;
    return this.get(path);
  },
  submitAnswer(examId, questionId, userAnswer, timeSpent, elapsedSeconds = null) {
    return this.post(`/exam/${examId}/answer`, {
      exam_id: examId,
      question_id: questionId,
      user_answer: userAnswer,
      time_spent_seconds: timeSpent,
      elapsed_seconds: elapsedSeconds,
    });
  },
  finishExam(examId, elapsedSeconds = null) { return this.post(`/exam/${examId}/finish`, { elapsed_seconds: elapsedSeconds }); },
  getExamPreview(examId) { return this.get(`/exam/${examId}/preview`); },
  getExamResult(examId) { return this.get(`/exam/${examId}/result`); },

  createQuestion(bankId, data) { return this.post(`/question-banks/${bankId}/questions`, data); },
  updateQuestion(questionId, data) { return this.request('PUT', `/questions/${questionId}`, data); },
  deleteQuestion(questionId) { return this.delete(`/questions/${questionId}`); },
  updateBank(bankId, data) { return this.request('PUT', `/question-banks/${bankId}`, data); },
  async exportBank(bankId) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${API_BASE}/question-banks/${bankId}/export`, { headers });
    if (!res.ok) {
      if (res.status === 401) _handle401(`/question-banks/${bankId}/export`);
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '导出失败');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = `bank-${bankId}.json`;
    const starMatch = disposition.match(/filename\*=UTF-8''(.+)/);
    if (starMatch) {
      filename = decodeURIComponent(starMatch[1]);
    } else {
      const plainMatch = disposition.match(/filename="?([^";]+?)"?(?:;|$)/);
      if (plainMatch) filename = plainMatch[1];
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getHistory(page = 1) { return this.get(`/history?page=${page}&page_size=20`); },
  getHistoryDetail(examId) { return this.get(`/history/${examId}`); },

  getWrongAnswers() { return this.get('/wrong-answers'); },
  startWrongAnswerExam(data) { return this.post('/wrong-answers/start', data); },

  getDashboard() { return this.get('/dashboard'); },

  getReviewQuestions(data) { return this.post('/review/questions', data); },
  getReviewChapters(data) { return this.post('/review/chapters', data); },
  markReview(questionId, status) { return this.post('/review/mark', { question_id: questionId, status }); },
  getReviewStats() { return this.get('/review/stats'); },
};
