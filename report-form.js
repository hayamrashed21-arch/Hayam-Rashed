// report-form.js — نموذج إضافة تقرير لكل الأنواع حسب <body data-type="ihc|pathology|cytology">
(function () {
  const L = window.LabCore;
  const type = document.body.dataset.type;
  const form = document.getElementById('patientForm');
  const statusDiv = document.getElementById('uploadStatus');
  const $ = (id) => document.getElementById(id);

  // [العمود, id الحقل, النوع: t نص | n رقم | d تاريخ]
  const COMMON = [['patient_name', 'patientName', 't'], ['age', 'age', 'n'], ['sex', 'sex', 't'], ['specimen_received_date', 'specimenReceivedDate', 'd'], ['referred_by', 'referredBy', 't'], ['clinical_data', 'clinicalData', 't']];
  const CFG = {
    ihc: { def: 'A1', enter: ['results', 'diagnosis'], fields: COMMON.concat([['date_report_issued', 'dateReportIssued', 'd'], ['specimen', 'specimen', 't'], ['procedure', 'procedure', 't'], ['results', 'results', 't'], ['diagnosis', 'diagnosis', 't']]) },
    pathology: { def: 'D1', enter: [], fields: COMMON.concat([['report_issued_date', 'reportIssuedDate', 'd'], ['specimen_information', 'specimenInformation', 't'], ['gross_picture', 'grossPicture', 't'], ['microscopic_picture', 'microscopicPicture', 't'], ['diagnosis', 'diagnosis', 't'], ['doctor_signature', 'doctorSignature', 't']]) },
    cytology: { def: 'C1', enter: [], fields: COMMON.concat([['report_issued_date', 'reportIssuedDate', 'd'], ['specimen_information', 'specimenInformation', 't'], ['microscopic_picture', 'microscopicPicture', 't'], ['diagnosis', 'diagnosis', 't'], ['doctor_signature', 'doctorSignature', 't']]) }
  }[type];

  const ID_OPTS = { maxSize: 600, quality: 0.8 };
  const EXTRA_OPTS = { maxSize: 1600, quality: 0.82 };
  const setStatus = (t, c) => { statusDiv.style.color = c || 'red'; statusDiv.textContent = t; };
  const shrink = async (f, o) => (typeof window.compressImage === 'function' ? window.compressImage(f, o) : f);
  const ext = (f) => f.name.split('.').pop().toLowerCase();

  async function initCode() { $('code').value = (await L.nextCode(type)) || CFG.def; }

  CFG.enter.forEach((id) => {
    const f = $(id); if (!f) return;
    f.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.slice(0, pos) + '\n• ' + e.target.value.slice(pos);
      e.target.selectionStart = e.target.selectionEnd = pos + 3;
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const code = $('code').value.trim();
    if (!code) return setStatus('❌ يرجى إدخال الكود');
    btn.disabled = true;
    const uploaded = [];
    try {
      setStatus('⏳ جاري التحقق من الكود...', '#04243f');
      // لا نرفع أي صورة قبل التأكد أن الكود غير مستخدم (حتى لا تُستبدل صور مريض آخر)
      if (await L.codeExists(type, code)) return setStatus('❌ هذا الكود مستخدم لمريض آخر');

      const photoFile = $('photo').files[0] || null;   // اختياري
      const extras = $('additionalPhotos').files;      // اختياري

      let photoPath = null;
      if (photoFile) {
        setStatus('⏳ جاري ضغط ورفع صورة الهوية...', '#04243f');
        const f = await shrink(photoFile, ID_OPTS);
        photoPath = `${code}/${code}.${ext(f)}`;
        await L.uploadFile(type, photoPath, f);
        uploaded.push(photoPath);
      }
      const extraPaths = [];
      for (let i = 0; i < extras.length; i++) {
        setStatus(`⏳ جاري ضغط ورفع الصورة ${i + 1} من ${extras.length}...`, '#04243f');
        const f = await shrink(extras[i], EXTRA_OPTS);
        const p = `${code}/img${i + 1}.${ext(f)}`;
        await L.uploadFile(type, p, f);
        uploaded.push(p);
        extraPaths.push(p);
      }

      const row = { code, photo_url: photoPath, additional_photos: extraPaths };
      CFG.fields.forEach(([col, id, kind]) => {
        const node = $(id); if (!node) return;
        const v = node.value.trim();
        row[col] = kind === 'n' ? (v === '' ? null : parseInt(v, 10)) : kind === 'd' ? (v === '' ? null : v) : v;
      });

      setStatus('⏳ جاري حفظ البيانات...', '#04243f');
      await L.insertRow(type, row);
      setStatus('✅ تم حفظ بيانات المريض بنجاح!', 'green');
      form.reset();
      await initCode();
    } catch (err) {
      console.error(err);
      try { await L.removeFiles(type, uploaded); } catch (_) {}   // لا ملفات يتيمة بدون سجل
      setStatus(String(err.message).includes('23505') ? '❌ هذا الكود مستخدم لمريض آخر' : '❌ حدث خطأ ولم يتم الحفظ، حاول مرة أخرى');
    } finally { btn.disabled = false; }
  });

  initCode();
})();
