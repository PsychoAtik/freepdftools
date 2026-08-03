(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const rotateOptions = document.getElementById('rotateOptions');
  const rotateBtn = document.getElementById('rotateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');

  let currentFile = null;
  let selectedDegrees = 90;

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
      rotateOptions.style.display = 'flex';
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `<span class="badge">PDF</span><span class="name">${escapeHtml(currentFile.name)}</span><span class="size">${formatSize(currentFile.size)}</span>`;
      fileListEl.appendChild(row);
      rotateBtn.disabled = false;
    } else {
      emptyState.style.display = 'block';
      rotateOptions.style.display = 'none';
      rotateBtn.disabled = true;
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

  rotateOptions.addEventListener('click', (e) => {
    const opt = e.target.closest('.rotate-option');
    if (!opt) return;
    document.querySelectorAll('.rotate-option').forEach(el => el.classList.remove('active'));
    opt.classList.add('active');
    selectedDegrees = parseInt(opt.dataset.degrees, 10);
  });

  clearBtn.addEventListener('click', () => {
    currentFile = null; fileInput.value = ''; statusMsg.innerHTML = ''; render();
  });

  rotateBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    rotateBtn.disabled = true;
    rotateBtn.textContent = 'Rotating…';
    statusMsg.innerHTML = '';

    try {
      const bytes = await currentFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();

      pages.forEach(page => {
        const current = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((current + selectedDegrees) % 360));
      });

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = currentFile.name.replace(/\.pdf$/i, '') + '-rotated.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      statusMsg.innerHTML = `<div class="status-msg success">Done — rotated file downloaded.</div>`;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong. Please try again.')}</div>`;
    } finally {
      rotateBtn.disabled = false;
      rotateBtn.textContent = 'Rotate PDF';
    }
  });

  render();
})();
