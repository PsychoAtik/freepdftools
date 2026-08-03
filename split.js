(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  const pageCountEl = document.getElementById('pageCount');
  const rangeBox = document.getElementById('rangeBox');
  const rangeInput = document.getElementById('rangeInput');
  const splitBtn = document.getElementById('splitBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');

  let currentFile = null;
  let totalPages = 0;

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
      row.innerHTML = `
        <span class="badge">PDF</span>
        <span class="name">${escapeHtml(currentFile.name)}</span>
        <span class="size">${formatSize(currentFile.size)}</span>
      `;
      fileListEl.appendChild(row);
    } else {
      emptyState.style.display = 'block';
      rangeBox.style.display = 'none';
      pageCountEl.textContent = '';
    }
  }

  async function setFile(fileListInput) {
    const f = Array.from(fileListInput).find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;

    currentFile = f;
    statusMsg.innerHTML = '';
    render();

    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(bytes);
      totalPages = doc.getPageCount();
      pageCountEl.textContent = `This PDF has ${totalPages} page${totalPages === 1 ? '' : 's'}.`;
      rangeBox.style.display = 'block';
      splitBtn.disabled = false;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">Couldn't read this PDF. It may be corrupted or password-protected.</div>`;
      currentFile = null;
      render();
    }
  }

  function parseRanges(input, max) {
    const indices = [];
    const parts = input.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) throw new Error('Please enter at least one page number.');

    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        let start = parseInt(rangeMatch[1], 10);
        let end = parseInt(rangeMatch[2], 10);
        if (start > end) [start, end] = [end, start];
        for (let i = start; i <= end; i++) {
          if (i < 1 || i > max) throw new Error(`Page ${i} doesn't exist — this PDF only has ${max} pages.`);
          indices.push(i - 1);
        }
      } else if (/^\d+$/.test(part)) {
        const n = parseInt(part, 10);
        if (n < 1 || n > max) throw new Error(`Page ${n} doesn't exist — this PDF only has ${max} pages.`);
        indices.push(n - 1);
      } else {
        throw new Error(`"${part}" isn't a valid page number or range.`);
      }
    }
    return indices;
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

  clearBtn.addEventListener('click', () => {
    currentFile = null;
    totalPages = 0;
    fileInput.value = '';
    rangeInput.value = '';
    statusMsg.innerHTML = '';
    splitBtn.disabled = true;
    render();
  });

  splitBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    statusMsg.innerHTML = '';
    splitBtn.disabled = true;
    splitBtn.textContent = 'Extracting…';

    try {
      const indices = parseRanges(rangeInput.value, totalPages);

      const bytes = await currentFile.arrayBuffer();
      const sourcePdf = await PDFLib.PDFDocument.load(bytes);
      const outPdf = await PDFLib.PDFDocument.create();

      const copiedPages = await outPdf.copyPages(sourcePdf, indices);
      copiedPages.forEach(page => outPdf.addPage(page));

      const outBytes = await outPdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.name.replace(/\.pdf$/i, '') + '-split.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      statusMsg.innerHTML = `<div class="status-msg success">Done — extracted ${indices.length} page${indices.length === 1 ? '' : 's'} and downloaded.</div>`;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong. Please check your page numbers and try again.')}</div>`;
    } finally {
      splitBtn.disabled = false;
      splitBtn.textContent = 'Extract Pages';
    }
  });

  render();
})();
