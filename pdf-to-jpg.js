(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const convertBtn = document.getElementById('convertBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');
  const progressLine = document.getElementById('progressLine');

  let currentFile = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    fileListEl.innerHTML = '';
    if (currentFile) {
      emptyState.style.display = 'none';
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `<span class="badge">PDF</span><span class="name">${escapeHtml(currentFile.name)}</span><span class="size">${formatSize(currentFile.size)}</span>`;
      fileListEl.appendChild(row);
      convertBtn.disabled = false;
    } else {
      emptyState.style.display = 'block';
      convertBtn.disabled = true;
    }
  }

  function setFile(fileListInput) {
    const f = Array.from(fileListInput).find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (f) { currentFile = f; statusMsg.innerHTML = ''; render(); }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', (e) => setFile(e.target.files));
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files); });

  clearBtn.addEventListener('click', () => {
    currentFile = null; fileInput.value = ''; statusMsg.innerHTML = ''; progressLine.textContent = ''; render();
  });

  convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting…';
    statusMsg.innerHTML = '';

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const baseName = currentFile.name.replace(/\.pdf$/i, '');
      const images = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        progressLine.textContent = `Rendering page ${i} of ${pdf.numPages}...`;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const jpegBytes = await (await fetch(jpegDataUrl)).blob();
        images.push({ name: `${baseName}-page-${i}.jpg`, blob: jpegBytes });
      }

      progressLine.textContent = '';

      if (images.length === 1) {
        const url = URL.createObjectURL(images[0].blob);
        const a = document.createElement('a');
        a.href = url; a.download = images[0].name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        images.forEach(img => zip.file(img.name, img.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url; a.download = `${baseName}-images.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }

      statusMsg.innerHTML = `<div class="status-msg success">Done — converted ${images.length} page${images.length === 1 ? '' : 's'} and downloaded.</div>`;
    } catch (err) {
      progressLine.textContent = '';
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong. Please try again.')}</div>`;
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert to JPG';
    }
  });

  render();
})();
