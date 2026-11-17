// imageCompress.js — ضغط الصور داخل المتصفح قبل الرفع (بدون أي مكتبة خارجية)
// الاستخدام: const file2 = await compressImage(file, { maxSize: 1600, quality: 0.82 })
// - يحافظ على الأبعاد النسبية ويصحح اتجاه الصورة (EXIF)
// - لا يكبّر الصور الصغيرة أبدًا
// - إذا لم يصغر الحجم فعليًا يرجع الملف الأصلي كما هو
// - يرجع ملف JPEG؛ الامتداد النهائي يكون jpg (أو يبقى الأصلي لو كان jpg/jpeg)

(function () {
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) { /* نكمل بالطريقة البديلة */ }
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function compressImage(file, opts) {
    const { maxSize = 1600, quality = 0.82 } = opts || {};
    try {
      if (!file || !file.type || !file.type.startsWith('image/')) return file;
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

      const bmp = await loadBitmap(file);
      const w0 = bmp.width, h0 = bmp.height;
      const scale = Math.min(1, maxSize / Math.max(w0, h0));
      const w = Math.round(w0 * scale), h = Math.round(h0 * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // خلفية بيضاء للصور الشفافة (PNG)
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      if (!blob) return file;

      const isJpeg = /\.(jpe?g)$/i.test(file.name);
      // لو الصورة الأصلية JPEG ولم نصغّرها فعليًا نبقي الأصل
      if (isJpeg && blob.size >= file.size) return file;

      const baseName = file.name.replace(/\.[^.]+$/, '');
      const newName = isJpeg ? file.name : baseName + '.jpg';
      return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
    } catch (err) {
      console.warn('compressImage: تعذر الضغط، سيتم رفع الأصل', err);
      return file;
    }
  }

  window.compressImage = compressImage;
})();
