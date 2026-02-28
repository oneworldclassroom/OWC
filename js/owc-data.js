/**
 * OWC Shared Data Layer
 * Connects the student platform (index.html) and admin panel (admin/index.html)
 * Data is persisted in localStorage and shared across both pages on the same domain.
 */

const OWC = (() => {

  const KEYS = {
    bookings:   'owc_bookings',
    students:   'owc_students',
    sessions:   'owc_sessions',
    payments:   'owc_payments',
    settings:   'owc_settings',
    adminAuth:  'owc_admin_auth',
  };

  /* ── helpers ── */
  const load  = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const save  = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid   = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const now   = () => new Date().toISOString();

  /* ── settings (object, not array) ── */
  const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(KEYS.settings)) || {}; } catch { return {}; }
  };
  const saveSettings = v => localStorage.setItem(KEYS.settings, JSON.stringify(v));

  /* ═══════════════════════════════════════
     BOOKINGS
  ═══════════════════════════════════════ */
  const getBookings = () => load(KEYS.bookings);

  const addBooking = ({ type, subject, name, hours, price, studentName, studentEmail, slots, notes }) => {
    const bookings = getBookings();
    const booking = {
      id:           'BK-' + uid(),
      type,           // 'session' | 'package' | 'custom' | 'mock'
      subject,
      name,
      hours:        hours || 1,
      price:        price || 0,
      studentName:  studentName || 'Guest',
      studentEmail: studentEmail || '',
      slots:        slots || [],
      notes:        notes || '',
      status:       'pending',    // pending | confirmed | completed | cancelled
      createdAt:    now(),
      updatedAt:    now(),
    };
    bookings.unshift(booking);
    save(KEYS.bookings, bookings);
    _emit('booking:new', booking);
    return booking;
  };

  const updateBookingStatus = (id, status) => {
    const bookings = getBookings();
    const i = bookings.findIndex(b => b.id === id);
    if (i > -1) {
      bookings[i].status    = status;
      bookings[i].updatedAt = now();
      save(KEYS.bookings, bookings);
      _emit('booking:updated', bookings[i]);
    }
  };

  /* ═══════════════════════════════════════
     STUDENTS
  ═══════════════════════════════════════ */
  const getStudents = () => load(KEYS.students);

  const upsertStudent = ({ name, email }) => {
    const students = getStudents();
    let student = students.find(s => s.email === email);
    if (!student) {
      student = { id: 'ST-' + uid(), name, email, joinedAt: now(), totalBookings: 0 };
      students.unshift(student);
    }
    student.totalBookings = getBookings().filter(b => b.studentEmail === email).length;
    student.updatedAt = now();
    save(KEYS.students, students);
    return student;
  };

  /* ═══════════════════════════════════════
     PAYMENTS
  ═══════════════════════════════════════ */
  const getPayments = () => load(KEYS.payments);

  const recordPayment = ({ bookingId, amount, method, studentEmail }) => {
    const payments = getPayments();
    const payment = {
      id:           'PAY-' + uid(),
      bookingId,
      amount,
      method:       method || 'card',
      studentEmail: studentEmail || '',
      status:       'completed',
      createdAt:    now(),
    };
    payments.unshift(payment);
    save(KEYS.payments, payments);
    _emit('payment:new', payment);
    return payment;
  };

  /* ═══════════════════════════════════════
     ADMIN AUTH
  ═══════════════════════════════════════ */
  // Simple hashed pin stored in localStorage.
  // Default password: owcadmin2025  (change via admin settings)
  const ADMIN_DEFAULT_HASH = '3d4f2b1a9c8e7f6d5b4a3c2e1f0d9b8a'; // placeholder

  const _simpleHash = str => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16);
  };

  const adminLogin = (password) => {
    const settings = loadSettings();
    const storedHash = settings.adminPasswordHash || _simpleHash('owcadmin2025');
    if (_simpleHash(password) === storedHash) {
      const session = { token: uid(), expiresAt: Date.now() + 8 * 3600 * 1000 };
      localStorage.setItem(KEYS.adminAuth, JSON.stringify(session));
      return true;
    }
    return false;
  };

  const adminLogout = () => localStorage.removeItem(KEYS.adminAuth);

  const isAdminLoggedIn = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEYS.adminAuth));
      return s && s.expiresAt > Date.now();
    } catch { return false; }
  };

  const changeAdminPassword = (oldPw, newPw) => {
    const settings = loadSettings();
    const storedHash = settings.adminPasswordHash || _simpleHash('owcadmin2025');
    if (_simpleHash(oldPw) !== storedHash) return false;
    settings.adminPasswordHash = _simpleHash(newPw);
    saveSettings(settings);
    return true;
  };

  /* ═══════════════════════════════════════
     STATS (used by admin dashboard)
  ═══════════════════════════════════════ */
  const getStats = () => {
    const bookings = getBookings();
    const payments = getPayments();
    const students = getStudents();
    const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const pending   = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    return { totalRevenue, pending, confirmed, completed, totalStudents: students.length, totalBookings: bookings.length };
  };

  /* ═══════════════════════════════════════
     SETTINGS
  ═══════════════════════════════════════ */
  const getSetting  = (key, fallback) => { const s = loadSettings(); return s[key] !== undefined ? s[key] : fallback; };
  const setSetting  = (key, val) => { const s = loadSettings(); s[key] = val; saveSettings(s); };

  /* ═══════════════════════════════════════
     EVENT BUS (cross-tab via StorageEvent)
  ═══════════════════════════════════════ */
  const _handlers = {};
  const _emit = (event, data) => {
    (_handlers[event] || []).forEach(fn => fn(data));
    // Notify other tabs (admin ↔ platform)
    try { localStorage.setItem('owc_event', JSON.stringify({ event, data, ts: Date.now() })); } catch {}
  };
  const on = (event, fn) => { _handlers[event] = _handlers[event] || []; _handlers[event].push(fn); };
  window.addEventListener('storage', e => {
    if (e.key === 'owc_event' && e.newValue) {
      try { const { event, data } = JSON.parse(e.newValue); (_handlers[event] || []).forEach(fn => fn(data)); } catch {}
    }
  });

  /* ── seed demo data if empty ── */
  const seedDemoData = () => {
    if (getBookings().length > 0) return; // already seeded
    const demos = [
      { type:'session', subject:'math', name:'Calculus I – Differentiation', hours:1, price:45, studentName:'Lena Fischer', studentEmail:'lena@example.de', status:'confirmed' },
      { type:'package', subject:'ielts', name:'IELTS Band 7 Intensive', hours:10, price:180, studentName:'Amir Khan', studentEmail:'amir@example.de', status:'pending' },
      { type:'session', subject:'prog', name:'Python Fundamentals', hours:1, price:45, studentName:'Julia Bauer', studentEmail:'julia@example.de', status:'completed' },
      { type:'package', subject:'bio', name:'Biology Exam Prep', hours:6, price:120, studentName:'Marco Weber', studentEmail:'marco@example.de', status:'confirmed' },
    ];
    const bookings = load(KEYS.bookings);
    demos.forEach(d => { bookings.push({ id:'BK-'+uid(), ...d, slots:[], notes:'', createdAt:now(), updatedAt:now() }); });
    save(KEYS.bookings, bookings);

    const students = load(KEYS.students);
    [['Lena Fischer','lena@example.de'],['Amir Khan','amir@example.de'],['Julia Bauer','julia@example.de'],['Marco Weber','marco@example.de']].forEach(([name,email]) => {
      students.push({ id:'ST-'+uid(), name, email, joinedAt:now(), totalBookings:1, updatedAt:now() });
    });
    save(KEYS.students, students);

    const payments = load(KEYS.payments);
    [45,180,45,120].forEach(amount => payments.push({ id:'PAY-'+uid(), amount, method:'card', status:'completed', createdAt:now() }));
    save(KEYS.payments, payments);
  };

  return {
    getBookings, addBooking, updateBookingStatus,
    getStudents, upsertStudent,
    getPayments, recordPayment,
    adminLogin, adminLogout, isAdminLoggedIn, changeAdminPassword,
    getStats,
    getSetting, setSetting,
    seedDemoData,
    on,
  };
})();
