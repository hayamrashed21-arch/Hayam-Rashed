// lab-core.js — الإعدادات والدوال المشتركة لكل صفحات النظام (classic script → window.LabCore)
(function () {
  const BUCKET = 'photo'; // نفس اسم الـ bucket في المشاريع الثلاثة (المسارات كما هي)

  const TYPES = {
    ihc: {
      label: 'IHC', title: 'IMMUNOHISTOCHEMISTRY REPORT', table: 'immunohistochemistry_report',
      url: 'https://bnmgxpkqjhhhccaroibc.supabase.co', dateKey: 'date_report_issued',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubWd4cGtxamhoaGNjYXJvaWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2ODM1ODksImV4cCI6MjA2MTI1OTU4OX0.tnIIQZWYr5NuZfjTWAdMgPYde6wTIFq08secQnqAnRs'
    },
    pathology: {
      label: 'Pathology', title: 'PATHOLOGY REPORT', table: 'pathology_report',
      url: 'https://fbxphgrumfifpanlkbzd.supabase.co', dateKey: 'report_issued_date',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZieHBoZ3J1bWZpZnBhbmxrYnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Mzg1NTQsImV4cCI6MjA2MTQxNDU1NH0.gaS2hTxSTniuedtKxTStMKC4e-72Y554aYTYGKEBoDE'
    },
    cytology: {
      label: 'Cytology', title: 'CYTOLOGY REPORT', table: 'cytology_reports',
      url: 'https://bimyioebtynlhxqzwqge.supabase.co', dateKey: 'report_issued_date',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpbXlpb2VidHlubGh4cXp3cWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Mzg2OTAsImV4cCI6MjA2MTQxNDY5MH0.dDvpl3X5H4hQ9BSFXEdg_eV0NJVF7K8FcNJ-R5-HEcw'
    }
  };

  const H = (t, extra) => Object.assign({ apikey: TYPES[t].key, Authorization: 'Bearer ' + TYPES[t].key }, extra || {});
  const encPath = (p) => String(p).split('/').map(encodeURIComponent).join('/');

  // ---------- قاعدة البيانات ----------
  async function rest(t, query, opt) {
    opt = opt || {};
    const r = await fetch(`${TYPES[t].url}/rest/v1/${TYPES[t].table}?${query}`, Object.assign({}, opt, { headers: H(t, opt.headers) }));
    const txt = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${txt}`);
    return txt ? JSON.parse(txt) : null;
  }

  async function fetchAll(t, extra) {
    const cols = 'id,code,patient_name,age,sex,photo_url,' + TYPES[t].dateKey + (extra ? ',' + extra : '');
    let out = [], off = 0;
    for (;;) {
      const page = await rest(t, `select=${cols}&order=id.desc&limit=1000&offset=${off}`);
      out = out.concat(page);
      if (page.length < 1000) break;
      off += 1000;
    }
    return out;
  }

  async function getByCode(t, code) {
    const rows = await rest(t, `select=*&code=eq.${encodeURIComponent(code)}&limit=1`);
    return rows && rows[0] ? rows[0] : null;
  }

  async function codeExists(t, code) {
    const rows = await rest(t, `select=id&code=eq.${encodeURIComponent(code)}&limit=1`);
    return !!(rows && rows.length);
  }

  // الكود التالي بنفس نمط آخر كود (مثال A12 → A13). يرجع '' إن لم يمكن استنتاجه
  async function nextCode(t) {
    try {
      const rows = await rest(t, 'select=code&order=id.desc&limit=1');
      if (!rows || !rows.length || !rows[0].code) return '';
      const m = String(rows[0].code).trim().match(/^(\D*)(\d+)$/);
      return m ? m[1] + (parseInt(m[2], 10) + 1) : '';
    } catch (e) { console.error(e); return ''; }
  }

  async function insertRow(t, row) {
    return rest(t, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify([row])
    });
  }

  // ---------- التخزين (نفس المسارات: الكود/الكود.ext و الكود/imgN.ext) ----------
  const publicUrl = (t, path) => `${TYPES[t].url}/storage/v1/object/public/${BUCKET}/${encPath(path)}`;

  async function uploadFile(t, path, file) {
    const r = await fetch(`${TYPES[t].url}/storage/v1/object/${BUCKET}/${encPath(path)}`, {
      method: 'POST',
      headers: H(t, { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' }),
      body: file
    });
    if (!r.ok) throw new Error(`upload ${r.status} ${await r.text()}`);
  }

  async function listFiles(t, code) {
    const r = await fetch(`${TYPES[t].url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: H(t, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: code + '/', limit: 200, offset: 0, sortBy: { column: 'name', order: 'asc' } })
    });
    if (!r.ok) throw new Error(`list ${r.status}`);
    const items = await r.json();
    return items.filter((f) => f.name && !f.name.startsWith('.')).map((f) => f.name);
  }

  async function removeFiles(t, paths) {
    if (!paths.length) return;
    const r = await fetch(`${TYPES[t].url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: H(t, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: paths })
    });
    if (!r.ok) throw new Error(`remove ${r.status}`);
  }

  // حذف مريض: السجل أولًا (ويُتحقق أنه حُذف فعلًا)، ثم كل ملفات مجلده
  async function deletePatient(t, code) {
    let files = [];
    try { files = await listFiles(t, code); } catch (e) { console.warn(e); }
    const deleted = await rest(t, `code=eq.${encodeURIComponent(code)}`, {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
    if (!deleted || !deleted.length) throw new Error('لم يُحذف أي سجل (تحقق من صلاحيات الحذف RLS)');
    try { await removeFiles(t, files.map((n) => `${code}/${n}`)); } catch (e) { console.warn('تعذر حذف بعض الصور', e); }
  }

  // ---------- البحث الذكي ----------
  // يتجاهل: التشكيل، التطويل، همزات الألف، ى/ي، ة/ه، الهمزة، الأرقام الهندية، حالة الأحرف اللاتينية
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u0640\u0300-\u036F]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      .replace(/[\u0621]/g, '')
      .replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x660)
      .replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 0x6F0)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  // 0 = كود مطابق تمامًا، 1 = يبدأ بالنص، 2 = كلمة تبدأ به، 3 = يحتويه، 9 = لا يطابق
  // كل كلمات البحث يجب أن توجد (بأي ترتيب) داخل الاسم أو الكود؛ ويكفي حرف واحد.
  function score(row, q) {
    const toks = norm(q).split(' ').filter(Boolean);
    if (!toks.length) return 9;
    const name = norm(row.patient_name), code = norm(row.code);
    if (!toks.every((t) => (name + ' ' + code).includes(t))) return 9;
    const nq = toks.join(' ');
    if (code === nq) return 0;
    if (name.startsWith(nq) || code.startsWith(nq)) return 1;
    if (name.split(' ').some((w) => w.startsWith(toks[0]))) return 2;
    return 3;
  }

  window.LabCore = { BUCKET, TYPES, rest, fetchAll, getByCode, codeExists, nextCode, insertRow,
    publicUrl, uploadFile, listFiles, removeFiles, deletePatient, norm, score };
})();
