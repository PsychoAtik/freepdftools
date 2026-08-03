(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const mergeBtn = document.getElementById('mergeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');

  /** @type {File[]} */
  let files = [];

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function render() {
    fileListEl.innerHTML = '';
    emptyState.style.display = files.length === 0 ? 'block' : 'none';

    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <span class="badge">PDF</span>
        <span class="name">${index + 1}. ${escapeHtml(file.name)}</span>
        <span class="size">${formatSize(file.size)}</span>
        <span class="move-btns">
          <button class="icon-btn" data-action="up" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="down" data-index="${index}" aria-label="Move down" ${index === files.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn remove" data-action="remove" data-index="${index}" aria-label="Remove file">✕</button>
        </span>
      `;
      fileListEl.appendChild(row);
    });

    mergeBtn.disabled = files.length < 2;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addFiles(fileListInput) {
    const incoming = Array.from(fileListInput).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    files = files.concat(incoming);
    statusMsg.innerHTML = '';
    render();
  }

  // --- Dropzone interactions ---
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  // --- File list actions ---
  fileListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const index = parseInt(btn.dataset.index, 10);
    const action = btn.dataset.action;

    if (action === 'remove') {
      files.splice(index, 1);
    } else if (action === 'up' && index > 0) {
      [files[index - 1], files[index]] = [files[index], files[index - 1]];
    } else if (action === 'down' && index < files.length - 1) {
      [files[index + 1], files[index]] = [files[index], files[index + 1]];
    }
    render();
  });

  clearBtn.addEventListener('click', () => {
    files = [];
    fileInput.value = '';
    statusMsg.innerHTML = '';
    render();
  });

  // --- Merge action ---
  mergeBtn.addEventListener('click', async () => {
    if (files.length < 2) return;

    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Merging…';
    statusMsg.innerHTML = '';

    try {
      const { PDFDocument } = PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let sourcePdf;
        try {
          sourcePdf = await PDFDocument.load(bytes);
        } catch (err) {
          throw new Error(`"${file.name}" could not be read. It may be corrupted or password-protected.`);
        }
        const pageIndices = sourcePdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      statusMsg.innerHTML = `<div class="status-msg success">Done — your merged PDF has downloaded as "merged.pdf".</div>`;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong while merging. Please try again.')}</div>`;
    } finally {
      mergeBtn.disabled = files.length < 2;
      mergeBtn.textContent = 'Merge PDFs';
    }
  });

  render();
})();
