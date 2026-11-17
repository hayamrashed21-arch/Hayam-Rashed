// search-engine.js — بحث بالاسم/الكود (يتجاهل التشكيل والهمزات ى/ي ة/ه، ويكفي حرف أو كلمة واحدة)
// الاستخدام: LabSearch.init('ihc' | 'pathology' | 'cytology', 'patient.html')
(function () {
  const L = window.LabCore;
  const AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#e6e9ee"/><circle cx="40" cy="31" r="14" fill="#9aa5b5"/><path d="M12 74c3-20 17-28 28-28s25 8 28 28z" fill="#9aa5b5"/></svg>');
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function init(type, page) {
    const input = document.getElementById('searchInput');
    const list = document.getElementById('patientsList');
    if (!input || !list || !L) return;
    let rows = null, at = 0, err = false, seq = 0, timer = null;

    async function load() {
      if (rows && !err && Date.now() - at < 120000) return;
      try { rows = await L.fetchAll(type); err = false; }
      catch (e) { console.error(e); err = true; rows = rows || []; }
      at = Date.now();
    }

    function card(r) {
      const c = el('div', 'patient-card');
      const img = el('img'); img.alt = 'صورة المريض'; img.loading = 'lazy';
      img.src = r.photo_url ? L.publicUrl(type, r.photo_url) : 'default-avatar.png';
      img.onerror = function () { this.onerror = function () { this.onerror = null; this.src = AVATAR; }; this.src = 'default-avatar.png'; };
      const info = el('div', 'patient-info');
      info.append(el('h3', null, r.patient_name || 'غير متوفر'), el('p', null, 'الكود: ' + (r.code || '')));
      const act = el('div', 'patient-actions');
      const v = el('button', null, 'عرض الملف'); v.onclick = () => window.openPatient(r.code);
      const d = el('button', null, 'حذف'); d.style.cssText = 'background-color:red;margin-right:5px'; d.onclick = () => remove(r);
      act.append(v, d);
      c.append(img, info, act);
      return c;
    }

    async function run() {
      const my = ++seq, q = input.value;
      if (!L.norm(q)) { list.replaceChildren(); load(); return; }
      if (!rows) list.replaceChildren(el('p', null, 'جاري التحميل...'));
      await load();
      if (my !== seq) return;
      const res = [];
      rows.forEach((r) => { const s = L.score(r, q); if (s < 9) res.push({ r, s }); });
      res.sort((a, b) => a.s - b.s || L.norm(a.r.patient_name).localeCompare(L.norm(b.r.patient_name), 'ar'));
      list.replaceChildren();
      if (err) list.append(el('p', null, '⚠️ تعذر تحميل أحدث البيانات، قد تكون النتائج ناقصة. تحقق من الاتصال.'));
      if (!res.length) { list.append(el('p', null, 'لا توجد نتائج.')); return; }
      res.slice(0, 100).forEach(({ r }) => list.append(card(r)));
      if (res.length > 100) list.append(el('p', null, `يتم عرض أول 100 من ${res.length} نتيجة، أضف كلمات لتضييق البحث.`));
    }

    async function remove(r) {
      if (!confirm(`⚠️ هل أنت متأكد من حذف المريض؟\n\nالاسم: ${r.patient_name}\nالكود: ${r.code}\n\nسيتم حذف التقرير وكل الصور نهائيًا.`)) return;
      try {
        await L.deletePatient(type, r.code);
        rows = rows.filter((x) => x.code !== r.code);
        alert('✅ تم حذف المريض بنجاح.');
        run();
      } catch (e) { console.error(e); alert('❌ لم يتم الحذف: ' + e.message); }
    }

    window.searchPatients = () => { clearTimeout(timer); timer = setTimeout(run, 120); };
    window.openPatient = (code) => { window.location.href = `${page}?code=${encodeURIComponent(code)}`; };
    load();
  }
  window.LabSearch = { init };
})();
