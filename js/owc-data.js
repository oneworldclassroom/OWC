/**
 * OWC Shared Data Layer v2
 * Real-time sync between Student Platform ↔ Admin Panel via localStorage + StorageEvent
 */
const OWC = (() => {

  const KEYS = {
    bookings:   'owc_bookings',
    students:   'owc_students',
    payments:   'owc_payments',
    settings:   'owc_settings',
    subjects:   'owc_subjects',
    sessions:   'owc_sessions_list',
    packages:   'owc_packages',
    adminAuth:  'owc_admin_auth',
    event:      'owc_event',
  };

  const load  = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const save  = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid   = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const now   = () => new Date().toISOString();

  /* ═══════════════════════════════════════
     SUBJECTS — admin enable/disable → platform reads this
  ═══════════════════════════════════════ */
  const DEFAULT_SUBJECTS = [
    {id:'math',   icon:'∫', name:'Mathematics',        active:true},
    {id:'eng',    icon:'⚙', name:'Engineering',         active:true},
    {id:'med',    icon:'⊕', name:'Medicine',             active:true},
    {id:'prompt', icon:'◎', name:'Prompt Engineering',  active:true},
    {id:'prog',   icon:'⌨', name:'Programming',          active:true},
    {id:'bio',    icon:'❧', name:'Biology',              active:true},
    {id:'phys',   icon:'⊛', name:'Physics',              active:true},
    {id:'chem',   icon:'⋈', name:'Chemistry',            active:true},
    {id:'ielts',  icon:'✎', name:'IELTS',                active:true},
    {id:'stats',  icon:'∑', name:'Statistics',           active:true},
    {id:'econ',   icon:'◈', name:'Economics',            active:true},
    {id:'lang',   icon:'◐', name:'German Language',      active:true},
    {id:'cs',     icon:'⊞', name:'Computer Science',     active:true},
    {id:'bus',    icon:'◉', name:'Business',             active:true},
    {id:'toefl',  icon:'✦', name:'TOEFL',                active:true},
    {id:'env',    icon:'❦', name:'Environmental Sci.',   active:true},
  ];

  const getSubjects = () => load(KEYS.subjects) || DEFAULT_SUBJECTS;

  const setSubjectActive = (id, active) => {
    const subjects = getSubjects();
    const s = subjects.find(s => s.id === id);
    if (s) {
      s.active = active;
      s.updatedAt = now();
      save(KEYS.subjects, subjects);
      _emit('subjects:changed', { id, active });
    }
  };

  const isSubjectActive = (id) => {
    const s = getSubjects().find(s => s.id === id);
    return s ? s.active : true; // default visible if unknown
  };

  /* ═══════════════════════════════════════
     PLATFORM SETTINGS
  ═══════════════════════════════════════ */
  const DEFAULT_SETTINGS = {
    maintenanceMode: false,
    registrationOpen: true,
    tutorApplicationsOpen: true,
    platformName: 'One World Classroom',
    pricePerHour: 20,
    adminPasswordHash: null,
  };

  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...(load(KEYS.settings) || {}) });
  const getSetting  = (key, fallback) => { const s = getSettings(); return s[key] !== undefined ? s[key] : fallback; };
  const setSetting  = (key, val) => {
    const s = getSettings();
    s[key] = val;
    save(KEYS.settings, s);
    _emit('settings:changed', { key, val });
  };

  /* ═══════════════════════════════════════
     BOOKINGS
  ═══════════════════════════════════════ */
  const getBookings = () => load(KEYS.bookings) || [];

  const addBooking = ({ type, subject, name, hours, price, studentName, studentEmail, slots, notes }) => {
    const bookings = getBookings();
    const booking = {
      id: 'BK-' + uid(), type, subject, name,
      hours: hours || 1, price: price || 0,
      studentName: studentName || 'Guest',
      studentEmail: studentEmail || '',
      slots: slots || [], notes: notes || '',
      status: 'pending', createdAt: now(), updatedAt: now(),
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
      bookings[i].status = status;
      bookings[i].updatedAt = now();
      save(KEYS.bookings, bookings);
      _emit('booking:updated', bookings[i]);
    }
  };

  /* ═══════════════════════════════════════
     STUDENTS
  ═══════════════════════════════════════ */
  const getStudents = () => load(KEYS.students) || [];

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
  const getPayments = () => load(KEYS.payments) || [];

  const recordPayment = ({ bookingId, amount, method, studentEmail }) => {
    const payments = getPayments();
    const payment = {
      id: 'PAY-' + uid(), bookingId, amount,
      method: method || 'card',
      studentEmail: studentEmail || '',
      status: 'completed', createdAt: now(),
    };
    payments.unshift(payment);
    save(KEYS.payments, payments);
    _emit('payment:new', payment);
    return payment;
  };

  /* ═══════════════════════════════════════
     ADMIN AUTH
  ═══════════════════════════════════════ */
  const _hash = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; return Math.abs(h).toString(16); };

  const adminLogin = (password) => {
    const settings = getSettings();
    const stored = settings.adminPasswordHash || _hash('owcadmin2025');
    if (_hash(password) === stored) {
      save(KEYS.adminAuth, { token: uid(), expiresAt: Date.now() + 8 * 3600 * 1000 });
      return true;
    }
    return false;
  };

  const adminLogout    = () => localStorage.removeItem(KEYS.adminAuth);
  const isAdminLoggedIn = () => { try { const s = load(KEYS.adminAuth); return s && s.expiresAt > Date.now(); } catch { return false; } };
  const changeAdminPassword = (oldPw, newPw) => {
    const s = getSettings();
    const stored = s.adminPasswordHash || _hash('owcadmin2025');
    if (_hash(oldPw) !== stored) return false;
    setSetting('adminPasswordHash', _hash(newPw));
    return true;
  };

  /* ═══════════════════════════════════════
     STATS
  ═══════════════════════════════════════ */
  const getStats = () => {
    const bookings = getBookings(), payments = getPayments(), students = getStudents();
    return {
      totalRevenue:  payments.reduce((s, p) => s + (p.amount || 0), 0),
      pending:       bookings.filter(b => b.status === 'pending').length,
      confirmed:     bookings.filter(b => b.status === 'confirmed').length,
      completed:     bookings.filter(b => b.status === 'completed').length,
      totalStudents: students.length,
      totalBookings: bookings.length,
    };
  };

  /* ═══════════════════════════════════════
     EVENT BUS
  ═══════════════════════════════════════ */
  const _handlers = {};
  const _emit = (event, data) => {
    (_handlers[event] || []).forEach(fn => fn(data));
    try { localStorage.setItem(KEYS.event, JSON.stringify({ event, data, ts: Date.now() })); } catch {}
  };
  const on = (event, fn) => { _handlers[event] = _handlers[event] || []; _handlers[event].push(fn); };

  window.addEventListener('storage', e => {
    if (e.key === KEYS.event && e.newValue) {
      try { const { event, data } = JSON.parse(e.newValue); (_handlers[event] || []).forEach(fn => fn(data)); } catch {}
    }
  });

  /* ── seed demo data once ── */
  const seedDemoData = () => {
    if (getBookings().length > 0) return;
    const demos = [
      { type:'session', subject:'math',  name:'Calculus I – Differentiation',  hours:1, price:45, studentName:'Lena Fischer',  studentEmail:'lena@example.de',  status:'confirmed' },
      { type:'package', subject:'ielts', name:'IELTS Band 7 Intensive',        hours:10,price:180,studentName:'Amir Khan',     studentEmail:'amir@example.de',  status:'pending'   },
      { type:'session', subject:'prog',  name:'Python Fundamentals',           hours:1, price:45, studentName:'Julia Bauer',   studentEmail:'julia@example.de', status:'completed' },
      { type:'package', subject:'bio',   name:'Biology Exam Prep',             hours:6, price:120,studentName:'Marco Weber',   studentEmail:'marco@example.de', status:'confirmed' },
    ];
    const bookings = [];
    demos.forEach(d => bookings.push({ id:'BK-'+uid(), ...d, slots:[], notes:'', createdAt:now(), updatedAt:now() }));
    save(KEYS.bookings, bookings);
    const students = [['Lena Fischer','lena@example.de'],['Amir Khan','amir@example.de'],['Julia Bauer','julia@example.de'],['Marco Weber','marco@example.de']];
    save(KEYS.students, students.map(([name,email]) => ({ id:'ST-'+uid(), name, email, joinedAt:now(), totalBookings:1 })));
    save(KEYS.payments, [45,180,45,120].map(amount => ({ id:'PAY-'+uid(), amount, method:'card', status:'completed', createdAt:now() })));
  };

  return {
    // Subjects
    getSubjects, setSubjectActive, isSubjectActive,
    // Bookings
    getBookings, addBooking, updateBookingStatus,
    // Students
    getStudents, upsertStudent,
    // Payments
    getPayments, recordPayment,
    // Auth
    adminLogin, adminLogout, isAdminLoggedIn, changeAdminPassword,
    // Settings
    getSettings, getSetting, setSetting,
    // Stats
    getStats,
    // Events
    on,
    // Seed
    seedDemoData,
  };
})();
