(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const qualityOptions = document.getElementById('qualityOptions');
  const resizeBtn = document.getElementById('resizeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');
  const progressLine = document.getElementById('progressLine');

  const SETTINGS = {
    light:    { scale: 2.0, jpegQuality: 0.85 },
    balanced: { scale: 1.5, jpegQuality: 0.6 },
    max:      { scale: 1.0, jpegQuality: 0.4 }
  };

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
      qualityOptions.style.display = 'flex';
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <span class="badge">PDF</span>
        <span class="name">${escapeHtml(currentFile.name)}</span>
        <span class="size">${formatSize(currentFile.size)}</span>
      `;
      fileListEl.appendChild(row);
      resizeBtn.disabled = false;
    } else {
      emptyState.style.display = 'block';
      qualityOptions.style.display = 'none';
      resizeBtn.disabled = true;
    }
  }

  function setFile(fileListInput) {
    const f = Array.from(fileListInput).find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (f) {
      currentFile = f;
      statusMsg.innerHTML = '';
      progressLine.textContent = '';
      render();
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', (e) => setFile(e.target.files));

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
  });
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files); });

  qualityOptions.addEventListener('click', (e) => {
    const label = e.target.closest('.quality-option');
    if (!label) return;
    document.querySelectorAll('.quality-option').forEach(el => el.classList.remove('active'));
    label.classList.add('active');
    label.querySelector('input').checked = true;
  });

  clearBtn.addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    statusMsg.innerHTML = '';
    progressLine.textContent = '';
    render();
  });

  resizeBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const selected = document.querySelector('input[name="quality"]:checked').value;
    const { scale, jpegQuality } = SETTINGS[selected];

    resizeBtn.disabled = true;
    resizeBtn.textContent = 'Resizing…';
    statusMsg.innerHTML = '';

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const { PDFDocument } = PDFLib;
      const outPdf = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        progressLine.textContent = `Processing page ${i} of ${pdf.numPages}...`;

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
        const jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
        const jpgImage = await outPdf.embedJpg(jpegBytes);

        const pdfPage = outPdf.addPage([viewport.width, viewport.height]);
        pdfPage.drawImage(jpgImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      }

      progressLine.textContent = '';
      const outBytes = await outPdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.name.replace(/\.pdf$/i, '') + '-resized.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const originalSize = formatSize(currentFile.size);
      const newSize = formatSize(outBytes.byteLength);
      statusMsg.innerHTML = `<div class="status-msg success">Done — file resized from ${originalSize} to ${newSize} and downloaded.</div>`;
    } catch (err) {
      progressLine.textContent = '';
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong while resizing. Please try again.')}</div>`;
    } finally {
      resizeBtn.disabled = false;
      resizeBtn.textContent = 'Resize PDF';
    }
  });

  render();
})();
