const API_BASE = '/api';

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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || '请求失败');
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
  deleteBank(id) { return this.delete(`/question-banks/${id}`); },

  startExam(data) { return this.post('/exam/start', data); },
  getCurrentQuestion(examId) { return this.get(`/exam/${examId}/current`); },
  submitAnswer(examId, questionId, userAnswer, timeSpent) {
    return this.post(`/exam/${examId}/answer`, {
      exam_id: examId,
      question_id: questionId,
      user_answer: userAnswer,
      time_spent_seconds: timeSpent,
    });
  },
  getExamResult(examId) { return this.get(`/exam/${examId}/result`); },

  getHistory(page = 1) { return this.get(`/history?page=${page}&page_size=20`); },
  getHistoryDetail(examId) { return this.get(`/history/${examId}`); },

  getWrongAnswers() { return this.get('/wrong-answers'); },

  getDashboard() { return this.get('/dashboard'); },
};
