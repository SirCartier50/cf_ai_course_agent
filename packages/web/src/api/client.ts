const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((error as any).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  register: (data: { email: string; name: string; password: string; role: string }) =>
    request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request<{ user: any }>('/auth/me'),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  createCourse: (data: { code: string; title: string; term: string; student_emails: string[]; agent_rules?: string; agent_persona?: string }) =>
    request<{ course: any; student_roster: any[] }>('/courses', { method: 'POST', body: JSON.stringify(data) }),

  listCourses: () => request<{ courses: any[] }>('/courses'),

  getCourse: (courseId: string) => request<{ course: any }>(`/courses/${courseId}`),

  getRoster: (courseId: string) => request<{ students: any[] }>(`/courses/${courseId}/roster`),

  revealCourseKey: (courseId: string, password: string) =>
    request<{ course_key: string }>(`/courses/${courseId}/reveal-key`, {
      method: 'POST', body: JSON.stringify({ password }),
    }),

  enrollInCourse: (courseKey: string, studentCourseId: string) =>
    request<{ enrolled: boolean; course: any }>('/courses/enroll', {
      method: 'POST', body: JSON.stringify({ course_key: courseKey, student_course_id: studentCourseId }),
    }),

  uploadSyllabus: (courseId: string, text: string) =>
    request<{ syllabus_id: string; status: string }>(`/courses/${courseId}/syllabus`, {
      method: 'POST', body: JSON.stringify({ text }),
    }),

  getSyllabus: (courseId: string) => request<any>(`/courses/${courseId}/syllabus`),

  getSyllabusStatus: (courseId: string) => request<{ status: string }>(`/courses/${courseId}/syllabus/status`),

  getDeadlines: (courseId: string) => request<{ deadlines: any[] }>(`/courses/${courseId}/deadlines`),

  getMaterials: (courseId: string, type?: string) =>
    request<{ materials: any[] }>(`/courses/${courseId}/materials${type ? `?type=${type}` : ''}`),

  getAnnouncements: (courseId: string) =>
    request<{ announcements: any[] }>(`/courses/${courseId}/announcements`),

  uploadMaterial: (courseId: string, data: { title: string; type: string; content: string; week_number?: number }) =>
    request<{ material: any }>(`/courses/${courseId}/materials`, { method: 'POST', body: JSON.stringify(data) }),

  deleteMaterial: (courseId: string, materialId: string) =>
    request<{ deleted: boolean }>(`/courses/${courseId}/materials/${materialId}`, { method: 'DELETE' }),

  sendMessage: (courseId: string, message: string, conversationId?: string) =>
    request<{ conversation_id: string; message: any }>(`/courses/${courseId}/chat`, {
      method: 'POST', body: JSON.stringify({ message, conversation_id: conversationId }),
    }),

  getChatHistory: (courseId: string, conversationId?: string) =>
    request<any>(`/courses/${courseId}/chat/history${conversationId ? `?conversation_id=${conversationId}` : ''}`),

  listTickets: (courseId: string, status?: string) =>
    request<{ tickets: any[] }>(`/courses/${courseId}/tickets${status ? `?status=${status}` : ''}`),

  getTicket: (courseId: string, ticketId: string) =>
    request<{ ticket: any; messages: any[] }>(`/courses/${courseId}/tickets/${ticketId}`),

  resolveTicket: (courseId: string, ticketId: string, data: { status: string; professor_response: string; absorb_to_knowledge_base?: boolean }) =>
    request<{ updated: boolean }>(`/courses/${courseId}/tickets/${ticketId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  getOverview: (courseId: string) => request<any>(`/courses/${courseId}/analytics/overview`),

  getAtRisk: (courseId: string) => request<{ students: any[] }>(`/courses/${courseId}/analytics/at-risk`),

  getTrending: (courseId: string) => request<any>(`/courses/${courseId}/analytics/trending`),
};
