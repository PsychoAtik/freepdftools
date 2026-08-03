(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const createBtn = document.getElementById('createBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');

  let files = [];

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
    emptyState.style.display = files.length === 0 ? 'block' : 'none';
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      const ext = file.type === 'image/png' ? 'PNG' : 'JPG';
      row.innerHTML = `
        <span class="badge">${ext}</span>
        <span class="name">${index + 1}. ${escapeHtml(file.name)}</span>
        <span class="size">${formatSize(file.size)}</span>
        <span class="move-btns">
          <button class="icon-btn" data-action="up" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="down" data-index="${index}" aria-label="Move down" ${index === files.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn remove" data-action="remove" data-index="${index}" aria-label="Remove image">✕</button>
        </span>`;
      fileListEl.appendChild(row);
    });
    createBtn.disabled = files.length < 1;
  }

  function addFiles(fileListInput) {
    const incoming = Array.from(fileListInput).filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    files = files.concat(incoming);
    statusMsg.innerHTML = '';
    render();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  fileListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const index = parseInt(btn.dataset.index, 10);
    const action = btn.dataset.action;
    if (action === 'remove') files.splice(index, 1);
    else if (action === 'up' && index > 0) [files[index - 1], files[index]] = [files[index], files[index - 1]];
    else if (action === 'down' && index < files.length - 1) [files[index + 1], files[index]] = [files[index], files[index + 1]];
    render();
  });

  clearBtn.addEventListener('click', () => {
    files = []; fileInput.value = ''; statusMsg.innerHTML = ''; render();
  });

  createBtn.addEventListener('click', async () => {
    if (files.length < 1) return;
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    statusMsg.innerHTML = '';

    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      const MAX_DIM = 1400;

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const image = file.type === 'image/png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        let { width, height } = image;

        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width *= ratio;
          height *= ratio;
        }

        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'images-to-pdf.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      statusMsg.innerHTML = `<div class="status-msg success">Done — your PDF has downloaded.</div>`;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong. Please try again.')}</div>`;
    } finally {
      createBtn.disabled = files.length < 1;
      createBtn.textContent = 'Create PDF';
    }
  });

  render();
})();
