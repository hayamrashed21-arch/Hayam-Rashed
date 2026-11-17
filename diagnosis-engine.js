// diagnosis-engine.js — البحث في التشخيص (نفس قواعد التطبيع: تشكيل/همزات/ى/ة)
// الاستخدام: LabDiag.init('ihc' | 'pathology' | 'cytology', 'patient.html')
(function () {
  const L = window.LabCore;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function init(type, page) {
    const input = document.getElementById('searchInput');
    const list = document.getElementById('patientsList');
    if (!input || !list || !L) return;
    let rows = null, at = 0, seq = 0;

    async function load() {
      if (rows && Date.now() - at < 120000) return;
      rows = await L.fetchAll(type, 'diagnosis');
      at = Date.now();
    }

    window.searchReports = async function () {
      const my = ++seq;
      const toks = L.norm(input.value).split(' ').filter(Boolean);
      if (!toks.length) { list.replaceChildren(el('p', null, 'يرجى إدخال كلمة للبحث.')); return; }
      list.replaceChildren(el('p', null, 'جاري البحث...'));
      try { await load(); } catch (e) { console.error(e); list.replaceChildren(el('p', null, 'حدث خطأ في البحث، تحقق من الاتصال.')); return; }
      if (my !== seq) return;
      const res = rows.filter((r) => { const h = L.norm(r.diagnosis) + ' ' + L.norm(r.patient_name) + ' ' + L.norm(r.code); return toks.every((t) => h.includes(t)); });
      res.sort((a, b) => L.norm(a.patient_name).localeCompare(L.norm(b.patient_name), 'ar'));
      list.replaceChildren();
      if (!res.length) { list.append(el('p', null, 'لا توجد نتائج.')); return; }
      res.slice(0, 100).forEach((r) => {
        const c = el('div', 'report-card');
        const info = el('div', 'report-info');
        info.append(el('h3', null, '📄 ' + (r.patient_name || 'بدون اسم') + ' — ' + (r.code || '')));
        const snippet = String(r.diagnosis || '').replace(/\s+/g, ' ').trim();
        if (snippet) info.append(el('p', null, snippet.length > 140 ? snippet.slice(0, 140) + '…' : snippet));
        const act = el('div', 'report-actions');
        const b = el('button', null, 'عرض');
        b.onclick = () => window.open(`${page}?code=${encodeURIComponent(r.code)}`, '_blank');
        act.append(b);
        c.append(info, act);
        list.append(c);
      });
      if (res.length > 100) list.append(el('p', null, `يتم عرض أول 100 من ${res.length} نتيجة.`));
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.searchReports(); });
  }
  window.LabDiag = { init };
})();
