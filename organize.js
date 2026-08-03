(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const emptyState = document.getElementById('emptyState');
  const thumbGrid = document.getElementById('thumbGrid');
  const progressLine = document.getElementById('progressLine');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMsg = document.getElementById('statusMsg');

  let currentFile = null;
  let pageOrder = []; // array of original page indices (0-based), reordered/filtered
  let thumbs = {}; // originalIndex -> dataUrl

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderGrid() {
    thumbGrid.innerHTML = '';
    pageOrder.forEach((origIndex, pos) => {
      const card = document.createElement('div');
      card.className = 'thumb-card';
      const img = document.createElement('img');
      img.src = thumbs[origIndex];
      img.style.width = '100%';
      img.style.display = 'block';
      img.style.borderBottom = '1px solid var(--line)';
      card.appendChild(img);

      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = `Page ${pos + 1}`;
      card.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'thumb-actions';
      actions.innerHTML = `
        <button class="icon-btn" data-action="up" data-pos="${pos}" ${pos === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-action="down" data-pos="${pos}" ${pos === pageOrder.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn remove" data-action="remove" data-pos="${pos}">✕</button>
      `;
      card.appendChild(actions);
      thumbGrid.appendChild(card);
    });
    saveBtn.disabled = pageOrder.length === 0;
  }

  thumbGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const pos = parseInt(btn.dataset.pos, 10);
    const action = btn.dataset.action;
    if (action === 'remove') {
      pageOrder.splice(pos, 1);
    } else if (action === 'up' && pos > 0) {
      [pageOrder[pos - 1], pageOrder[pos]] = [pageOrder[pos], pageOrder[pos - 1]];
    } else if (action === 'down' && pos < pageOrder.length - 1) {
      [pageOrder[pos + 1], pageOrder[pos]] = [pageOrder[pos], pageOrder[pos + 1]];
    }
    renderGrid();
  });

  async function setFile(fileListInput) {
    const f = Array.from(fileListInput).find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;

    currentFile = f;
    statusMsg.innerHTML = '';
    emptyState.style.display = 'none';
    thumbGrid.innerHTML = '';
    thumbs = {};
    pageOrder = [];

    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        progressLine.textContent = `Loading page ${i} of ${pdf.numPages}...`;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs[i - 1] = canvas.toDataURL('image/jpeg', 0.7);
        pageOrder.push(i - 1);
      }
      progressLine.textContent = '';
      renderGrid();
    } catch (err) {
      progressLine.textContent = '';
      statusMsg.innerHTML = `<div class="status-msg error">Couldn't read this PDF. It may be corrupted or password-protected.</div>`;
      currentFile = null;
      emptyState.style.display = 'block';
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', (e) => setFile(e.target.files));
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files); });

  clearBtn.addEventListener('click', () => {
    currentFile = null; fileInput.value = ''; thumbs = {}; pageOrder = [];
    thumbGrid.innerHTML = ''; statusMsg.innerHTML = ''; progressLine.textContent = '';
    emptyState.style.display = 'block';
    saveBtn.disabled = true;
  });

  saveBtn.addEventListener('click', async () => {
    if (!currentFile || pageOrder.length === 0) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    statusMsg.innerHTML = '';

    try {
      const bytes = await currentFile.arrayBuffer();
      const sourcePdf = await PDFLib.PDFDocument.load(bytes);
      const outPdf = await PDFLib.PDFDocument.create();

      const copiedPages = await outPdf.copyPages(sourcePdf, pageOrder);
      copiedPages.forEach(page => outPdf.addPage(page));

      const outBytes = await outPdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = currentFile.name.replace(/\.pdf$/i, '') + '-organized.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      statusMsg.innerHTML = `<div class="status-msg success">Done — ${pageOrder.length} page${pageOrder.length === 1 ? '' : 's'} saved and downloaded.</div>`;
    } catch (err) {
      statusMsg.innerHTML = `<div class="status-msg error">${escapeHtml(err.message || 'Something went wrong. Please try again.')}</div>`;
    } finally {
      saveBtn.disabled = pageOrder.length === 0;
      saveBtn.textContent = 'Save Changes';
    }
  });
})();
