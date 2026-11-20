let appState = {
  hasLoadedData: false,
  reportTitleMain: 'สรุปจำนวนกลุ่มเรียนที่บันทึกคะแนน ระดับปริญญาตรี ภาค 1/2569 รอบที่ 2',
  reportRoundLabel: 'การบันทึกคะแนนเก็บ รอบที่ 2 (ครั้งที่ 6-10)',
  reportDateLabel: 'รอการนำเข้าข้อมูล',
  excludedCount: 0,
  notDueCount: 0,

  inPlanSummary: {
    subjectCount: 0,
    totalGroups: 0,
    recordedGroups: 0,
    recordedPct: 0,
    unrecordedGroups: 0,
    unrecordedPct: 0,
    faculties: []
  },
  outOfPlanSummary: {
    subjectCount: 0,
    totalGroups: 0,
    recordedGroups: 0,
    recordedPct: 0,
    unrecordedGroups: 0,
    unrecordedPct: 0,
    faculties: []
  },

  detailRecords: [],
  overviewReportType: 'IN_PLAN',
  overviewSort: { key: 'order', dir: 'asc' },

  page2CourseType: 'IN_PLAN',
  page2CardView: 'ALL', // 'ALL' | 'RECORDED' | 'UNRECORDED' | 'SUCCESS'
  page2Sort: {
    unrecorded: { key: 'courseCode', dir: 'asc' },
    recorded: { key: 'courseCode', dir: 'asc' }
  },

  page3Sort: {
    inUnrec: { key: 'courseCode', dir: 'asc' },
    inRec: { key: 'courseCode', dir: 'asc' },
    outUnrec: { key: 'courseCode', dir: 'asc' },
    outRec: { key: 'courseCode', dir: 'asc' }
  },

  // Staging & History for Excel Import UX
  stagedImport: null,
  importHistory: [],
  highlightFacultyName: '',

  charts: {
    overviewDonut: null,
    p2MajorChart: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Sarabun', sans-serif";
    Chart.defaults.color = '#434C6B';
  }

  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.addEventListener('change', handleExcelFileSelected);

  setupDragAndDrop();
  renderAllViews();
});

// ==================== NAVIGATION, DRILL-DOWN & PRESENTATION ====================
function switchPage(pageKey, btnEl = null) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === pageKey);
  });
  if (btnEl) btnEl.classList.add('active');

  ['overview', 'faculty', 'lecturer'].forEach(p => {
    const sec = document.getElementById(`page-${p}`);
    if (sec) sec.style.display = p === pageKey ? 'block' : 'none';
  });

  updateDrilldownBreadcrumb(pageKey);

  if (pageKey === 'overview') renderOverviewInsightsAndDonut();
  else if (pageKey === 'faculty') renderPage2FacultyAnalysis();
  else if (pageKey === 'lecturer') renderPage3LecturerAnalysis();
}

function updateDrilldownBreadcrumb(activePage) {
  const bc = document.getElementById('drilldownBreadcrumb');
  if (!bc) return;

  const selFac = document.getElementById('p2FacultySelect')?.value || 'ALL';
  const selMaj = document.getElementById('p2MajorSelect')?.value || 'ALL';
  const selLec = document.getElementById('p3LecturerSelect')?.value || '';

  let html = `<span class="drill-item ${activePage === 'overview' ? 'active' : ''}" onclick="drillToOverview()">มหาวิทยาลัย</span>`;

  if (activePage === 'faculty' || activePage === 'lecturer') {
    const facLabel = selFac === 'ALL' ? 'ทุกคณะ' : selFac;
    html += `<span class="drill-sep">›</span><span class="drill-item ${activePage === 'faculty' && selMaj === 'ALL' ? 'active' : ''}" onclick="drillToFaculty('${escapeHtml(selFac).replace(/'/g, "\\'")}')">${escapeHtml(facLabel)}</span>`;
    if (selMaj !== 'ALL') {
      html += `<span class="drill-sep">›</span><span class="drill-item ${activePage === 'faculty' ? 'active' : ''}" onclick="drillToMajor('${escapeHtml(selFac).replace(/'/g, "\\'")}', '${escapeHtml(selMaj).replace(/'/g, "\\'")}')">${escapeHtml(selMaj)}</span>`;
    }
  }

  if (activePage === 'lecturer') {
    const lecLabel = selLec || 'รายชื่ออาจารย์';
    html += `<span class="drill-sep">›</span><span class="drill-item active">${escapeHtml(lecLabel)}</span>`;
  }

  bc.innerHTML = html;
}

function drillToOverview() {
  switchPage('overview');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillToFaculty(facultyName, courseType = null) {
  if (courseType) {
    setPage2CourseType(courseType);
  } else {
    setPage2CourseType(appState.overviewReportType);
  }
  const facSelect = document.getElementById('p2FacultySelect');
  if (facSelect) {
    facSelect.value = facultyName || 'ALL';
    updatePage2MajorOptions();
  }
  const majSelect = document.getElementById('p2MajorSelect');
  if (majSelect) majSelect.value = 'ALL';

  // เมื่อเจาะลึกเข้าคณะ ให้เปิดดูตารางสรุปรายสาขาวิชาทันที (หากเลือกทุกคณะให้แสดงตารางสรุปรายคณะ)
  selectPage2CardView(facultyName && facultyName !== 'ALL' ? 'SUCCESS' : 'ALL');

  switchPage('faculty');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillToMajor(facultyName, majorName) {
  const facSelect = document.getElementById('p2FacultySelect');
  if (facSelect && facultyName) {
    facSelect.value = facultyName;
    updatePage2MajorOptions();
  }
  const majSelect = document.getElementById('p2MajorSelect');
  if (majSelect) majSelect.value = majorName || 'ALL';

  // เมื่อเจาะลึกเข้าสาขาวิชา ให้แสดงตารางรายชื่อกลุ่มเรียนที่ยังไม่บันทึกเป็นหลัก
  selectPage2CardView('UNRECORDED');

  switchPage('faculty');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillToHighlightFaculty() {
  if (!appState.highlightFacultyName) return;
  drillToFaculty(appState.highlightFacultyName, appState.overviewReportType);
}

function drillToProgramInstructors(facultyName, majorName) {
  const p3Fac = document.getElementById('p3FacultyFilterSelect');
  const p3Maj = document.getElementById('p3MajorFilterSelect');
  const p3Lec = document.getElementById('p3LecturerSelect');
  if (p3Fac) p3Fac.value = facultyName || 'ALL';
  updatePage3MajorFilterOptions();
  if (p3Maj) p3Maj.value = majorName || 'ALL';
  if (p3Lec) p3Lec.value = '';
  updateLecturerDropdownOptions();
  switchPage('lecturer');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillToInstructorDetail(lecturerName) {
  if (!lecturerName || lecturerName === 'ไม่ระบุผู้สอน') return;
  if (document.getElementById('p3FacultyFilterSelect')) document.getElementById('p3FacultyFilterSelect').value = 'ALL';
  updatePage3MajorFilterOptions();
  if (document.getElementById('p3MajorFilterSelect')) document.getElementById('p3MajorFilterSelect').value = 'ALL';
  if (document.getElementById('p3StatusFilterSelect')) document.getElementById('p3StatusFilterSelect').value = 'ALL';
  if (document.getElementById('p3TableStatusFilterSelect')) document.getElementById('p3TableStatusFilterSelect').value = 'ALL';
  if (document.getElementById('p3LecturerSearchInput')) document.getElementById('p3LecturerSearchInput').value = '';
  updateLecturerDropdownOptions();
  const sel = document.getElementById('p3LecturerSelect');
  if (sel) sel.value = lecturerName;
  switchPage('lecturer');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePresentationMode() {
  document.body.classList.toggle('presentation-mode');
  const btn = document.getElementById('btnPresentation');
  const isPres = document.body.classList.contains('presentation-mode');
  if (btn) {
    btn.innerHTML = isPres
      ? '<span>✕ ออกจากโหมดนำเสนอ</span>'
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg><span>โหมดนำเสนอ</span>`;
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toastMsg');
  if (!toast) return;
  toast.textContent = message;
  toast.style.borderLeftColor = isError ? '#D59A32' : '#269C79';
  toast.style.display = 'flex';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 4500);
}

function syncTermBannerFromSelectors() {
  const yr = document.getElementById('ovYearSelect')?.value || '2569';
  const sem = document.getElementById('ovSemSelect')?.value || '1';
  const rnd = document.getElementById('ovRoundSelect')?.value || '2';
  const roundText = rnd === '1' ? 'การบันทึกคะแนนเก็บ รอบที่ 1 (ครั้งที่ 1-5)' : 'การบันทึกคะแนนเก็บ รอบที่ 2 (ครั้งที่ 6-10)';
  setText('activeTermBadge', `สรุปจำนวนกลุ่มเรียนที่บันทึกคะแนน ระดับปริญญาตรี ภาค ${sem}/${yr} รอบที่ ${rnd}`);
  setText('activeRoundChip', roundText);

  const footerRoundLabel = rnd === '1' ? 'รอบที่ 1 (ครั้งที่ 1-5)' : 'รอบที่ 2 (ครั้งที่ 6-10)';
  setText('footerTermRoundText', `ภาค ${sem}-${yr} ${footerRoundLabel}`);
}

// ==================== EXCEL IMPORT MODAL, PREVIEW & VALIDATION ====================
function openExcelImportModal() {
  const modal = document.getElementById('excelImportModal');
  if (modal) modal.style.display = 'flex';
  switchModalTab('wizard');
}

function closeExcelImportModal() {
  const modal = document.getElementById('excelImportModal');
  if (modal) modal.style.display = 'none';
}

function switchModalTab(tabName) {
  const isWizard = tabName === 'wizard';
  document.getElementById('tabImportWizard')?.classList.toggle('active', isWizard);
  document.getElementById('tabImportHistory')?.classList.toggle('active', !isWizard);
  const bodyWiz = document.getElementById('modalBodyWizard');
  const bodyHis = document.getElementById('modalBodyHistory');
  if (bodyWiz) bodyWiz.style.display = isWizard ? 'block' : 'none';
  if (bodyHis) bodyHis.style.display = isWizard ? 'none' : 'block';
  if (!isWizard) renderImportHistoryTable();
}

function setupDragAndDrop() {
  const dropzone = document.getElementById('excelDropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(evtName => {
    dropzone.addEventListener(evtName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evtName => {
    dropzone.addEventListener(evtName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', e => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      stageExcelFile(files[0]);
    }
  });
}

function handleExcelFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    stageExcelFile(file);
  }
  event.target.value = '';
}

function stageExcelFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // Run dry-run validation using source-truth parsing logic
      const validation = validateWorkbookBeforeImport(workbook);

      appState.stagedImport = {
        fileName: file.name,
        fileSizeKB: (file.size / 1024).toFixed(1),
        workbook,
        validation
      };

      document.getElementById('excelStagingArea').style.display = 'block';
      setText('stagedFileName', file.name);
      setText('stagedFileSize', `ขนาดไฟล์: ${appState.stagedImport.fileSizeKB} KB • พบทั้งหมด ${workbook.SheetNames.length} ชีต • สถานะ: พร้อมตรวจสอบ`);

      setText('valValidRowsCount', `${validation.validCount.toLocaleString()} รายการ`);
      setText('valSheetSummaryText', validation.sheetSummary);
      setText('valErrorRowsCount', `${validation.issues.length.toLocaleString()} รายการ`);
      setText(
        'valErrorHintText',
        validation.issues.length === 0 ? 'ผ่านการตรวจสอบความถูกต้องครบถ้วน' : 'พบรายการที่ควรตรวจสอบเพิ่มเติมด้านล่าง'
      );

      const issuesBox = document.getElementById('validationIssuesBox');
      const issuesList = document.getElementById('validationIssuesList');
      if (validation.issues.length > 0 && issuesBox && issuesList) {
        issuesBox.style.display = 'block';
        issuesList.innerHTML = validation.issues.map(msg => `<li>${escapeHtml(msg)}</li>`).join('');
      } else if (issuesBox) {
        issuesBox.style.display = 'none';
      }

      const sheetSelect = document.getElementById('previewSheetSelect');
      if (sheetSelect) {
        sheetSelect.innerHTML = workbook.SheetNames.map(
          s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
        ).join('');
      }
      renderExcelPreviewSheet();

      const confirmBtn = document.getElementById('btnConfirmImport');
      if (confirmBtn) confirmBtn.disabled = false;
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์', true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function hasDedicatedDetailSheets(workbook) {
  return workbook.SheetNames.some(s => {
    const norm = normalizeText(s);
    return norm === 'รายวิชาตามแผน' || norm === 'รายวิชานอกแผน';
  });
}

function validateWorkbookBeforeImport(workbook) {
  const issues = [];
  const sheetSumIn = findSheet(workbook, ['สรุปการบันทึก (ตามแผน)', 'สรุปการบันทึก(ตามแผน)', 'สรุปตามแผน']);
  const sheetSumOut = findSheet(workbook, ['สรุปการบันทึก(นอกแผน)', 'สรุปการบันทึก (นอกแผน)', 'สรุปนอกแผน']);

  if (!sheetSumIn && !sheetSumOut) {
    issues.push('ไม่พบชีตสรุปผลมาตรฐาน ("สรุปการบันทึก (ตามแผน)" หรือ "สรุปการบันทึก(นอกแผน)")');
  }

  let validCount = 0;
  const seenKeys = new Map();
  const skipPivotSheets = hasDedicatedDetailSheets(workbook);

  workbook.SheetNames.forEach(sheetName => {
    const norm = normalizeText(sheetName);
    if (norm.includes('สรุป') || norm.includes('ยกเว้น') || norm.includes('ยังไม่ถึงกำหนด')) return;
    if (skipPivotSheets && norm.startsWith('รายงานการบันทึก')) return;

    const sheet = workbook.Sheets[sheetName];
    let cType = null;
    if (norm.includes('นอกแผน')) cType = 'OUT_OF_PLAN';
    else if (norm.includes('ตามแผน')) cType = 'IN_PLAN';

    const parsed = parseDetailSheet(sheet, cType, null, issues, sheetName);
    validCount += parsed.length;

    parsed.forEach((item, idx) => {
      if (!item.courseCode || !item.courseName) {
        issues.push(`ชีต "${sheetName}" แถวข้อมูลที่ ${idx + 1}: ข้อมูลรหัสวิชาหรือชื่อวิชาว่าง`);
      }
      if (item.lecturer === 'ไม่ระบุผู้สอน') {
        issues.push(`ชีต "${sheetName}" รหัสวิชา ${item.courseCode} กลุ่ม ${item.section}: ไม่ระบุชื่ออาจารย์ผู้สอน`);
      }
      const dupKey = `${item.courseType}|${item.courseCode}|${item.section}|${item.lecturer}`;
      if (seenKeys.has(dupKey)) {
        const prevStatus = seenKeys.get(dupKey);
        if (prevStatus !== item.status) {
          issues.push(`ชีต "${sheetName}" รหัสวิชา ${item.courseCode} กลุ่ม ${item.section} (${item.lecturer}): พบข้อมูลต้นทางขัดแย้งกันระหว่างสถานะบันทึกแล้วและยังไม่บันทึก`);
        } else {
          issues.push(`ชีต "${sheetName}" รหัสวิชา ${item.courseCode} กลุ่ม ${item.section} (${item.lecturer}): พบข้อมูลซ้ำซ้อน`);
        }
      } else {
        seenKeys.set(dupKey, item.status);
      }
    });
  });

  const summaryFaculties =
    (sheetSumIn ? parseSummarySheet(sheetSumIn).faculties.length : 0) +
    (sheetSumOut ? parseSummarySheet(sheetSumOut).faculties.length : 0);

  return {
    validCount: validCount > 0 ? validCount : summaryFaculties,
    sheetSummary: `ชีตสรุปตามแผน: ${sheetSumIn ? 'พบ' : 'ไม่พบ'} • ชีตสรุปนอกแผน: ${sheetSumOut ? 'พบ' : 'ไม่พบ'}`,
    issues: issues.slice(0, 30)
  };
}

function renderExcelPreviewSheet() {
  if (!appState.stagedImport) return;
  const sheetName = document.getElementById('previewSheetSelect')?.value;
  const sheet = appState.stagedImport.workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const previewRows = rows.slice(0, 15);

  setText('previewSheetDimensions', `ชีต "${sheetName}" • ทั้งหมด ${rows.length.toLocaleString()} แถว × ${maxCols} คอลัมน์ (แสดง 15 แถวแรก)`);

  const thead = document.getElementById('previewTableHead');
  const tbody = document.getElementById('previewTableBody');
  if (!thead || !tbody) return;

  if (previewRows.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td class="empty-table-cell">ไม่พบข้อมูลในชีตนี้</td></tr>`;
    return;
  }

  let headHtml = '<tr><th style="width: 50px; text-align: center;">แถว</th>';
  for (let c = 0; c < maxCols; c++) {
    headHtml += `<th>คอลัมน์ ${c + 1}</th>`;
  }
  headHtml += '</tr>';
  thead.innerHTML = headHtml;

  tbody.innerHTML = previewRows
    .map((r, rIdx) => {
      let cells = `<td style="text-align: center; font-weight: 700; color: #687394;">${rIdx + 1}</td>`;
      for (let c = 0; c < maxCols; c++) {
        cells += `<td>${escapeHtml(r[c] ?? '')}</td>`;
      }
      return `<tr>${cells}</tr>`;
    })
    .join('');
}

function confirmExcelImport() {
  if (!appState.stagedImport) return;
  const { workbook, fileName } = appState.stagedImport;

  // Execute core business logic with verified source-truth status
  parseWorkbookData(workbook, fileName);

  const nowStr = new Date().toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  appState.importHistory.unshift({
    fileName,
    importedAt: nowStr,
    recordCount: appState.detailRecords.length,
    status: 'นำเข้าสำเร็จ'
  });
  setText('importHistoryBadge', appState.importHistory.length.toString());

  closeExcelImportModal();
}

function renderImportHistoryTable() {
  const tbody = document.getElementById('tbodyImportHistory');
  if (!tbody) return;
  if (appState.importHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-cell">ยังไม่มีประวัติการนำเข้าข้อมูลในเซสชันนี้</td></tr>`;
    return;
  }
  tbody.innerHTML = appState.importHistory
    .map(
      (h, idx) => `
    <tr>
      <td style="text-align: center;">${appState.importHistory.length - idx}</td>
      <td><strong>${escapeHtml(h.fileName)}</strong></td>
      <td>${escapeHtml(h.importedAt)}</td>
      <td style="text-align: center;">${h.recordCount.toLocaleString()} รายการ</td>
      <td style="text-align: center;"><span class="kpi-pct-pill pill-green">${escapeHtml(h.status)}</span></td>
    </tr>
  `
    )
    .join('');
}

// ==================== CORE EXCEL PARSING LOGIC (100% PRESERVED) ====================
function normalizeText(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase().trim();
}

function findSheet(workbook, candidates) {
  for (const cand of candidates) {
    const normCand = normalizeText(cand);
    const found = workbook.SheetNames.find(s => normalizeText(s) === normCand);
    if (found) return workbook.Sheets[found];
  }
  for (const cand of candidates) {
    const normCand = normalizeText(cand);
    const found = workbook.SheetNames.find(s => normalizeText(s).includes(normCand));
    if (found) return workbook.Sheets[found];
  }
  return null;
}

function parsePctValue(rawVal, numerator, denominator) {
  if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
    const num = Number(String(rawVal).replace(/%/g, '').trim());
    if (!Number.isNaN(num)) {
      return num <= 1.0001 && denominator > 0 && numerator <= denominator ? num * 100 : num;
    }
  }
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function parseSummarySheet(sheet) {
  const result = {
    titleMain: '',
    dateLabel: '',
    roundLabel: '',
    subjectCount: 0,
    totalGroups: 0,
    recordedGroups: 0,
    recordedPct: 0,
    unrecordedGroups: 0,
    unrecordedPct: 0,
    faculties: []
  };
  if (!sheet) return result;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows[0] && rows[0][0]) result.titleMain = String(rows[0][0]).replace(/ตามแผน|นอกแผน/g, '').trim();
  if (rows[1] && rows[1][0]) result.dateLabel = String(rows[1][0]).trim();
  if (rows[2] && rows[2][2]) result.roundLabel = String(rows[2][2]).trim();

  let hasExplicitTotalRow = false;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 7) continue;
    const col0 = String(r[0] ?? '').trim();
    const col1 = String(r[1] ?? '').trim();
    if (!col0 && !col1) continue;

    const subj = Number(r[2]) || 0;
    const total = Number(r[3]) || 0;
    const rec = Number(r[4]) || 0;
    const recPct = parsePctValue(r[5], rec, total);
    const unrec = Number(r[6]) || 0;
    const unrecPct = parsePctValue(r[7], unrec, total);

    if (col0.includes('รวม') || col1.includes('รวม')) {
      hasExplicitTotalRow = true;
      result.subjectCount = subj;
      result.totalGroups = total;
      result.recordedGroups = rec;
      result.recordedPct = recPct;
      result.unrecordedGroups = unrec;
      result.unrecordedPct = unrecPct;
      break;
    }

    if (col1) {
      result.faculties.push({
        order: Number(col0) || result.faculties.length + 1,
        faculty: col1,
        subjectCount: subj,
        totalGroups: total,
        recordedGroups: rec,
        recordedPct: recPct,
        unrecordedGroups: unrec,
        unrecordedPct: unrecPct
      });
    }
  }

  if (!hasExplicitTotalRow && result.faculties.length > 0) {
    result.subjectCount = result.faculties.reduce((s, f) => s + f.subjectCount, 0);
    result.totalGroups = result.faculties.reduce((s, f) => s + f.totalGroups, 0);
    result.recordedGroups = result.faculties.reduce((s, f) => s + f.recordedGroups, 0);
    result.unrecordedGroups = result.faculties.reduce((s, f) => s + f.unrecordedGroups, 0);
    result.recordedPct = result.totalGroups > 0 ? (result.recordedGroups / result.totalGroups) * 100 : 0;
    result.unrecordedPct = result.totalGroups > 0 ? (result.unrecordedGroups / result.totalGroups) * 100 : 0;
  }
  return result;
}

function parseDetailSheet(sheet, courseType, forceStatus = null, conflictLog = null, sheetLabel = '') {
  const items = [];
  if (!sheet) return items;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rowCells = rows[i].map(c => normalizeText(c));
    const hasCode = rowCells.some(c => c.includes('รหัสวิชา') || c === 'รหัส' || c.includes('coursecode'));
    const hasName = rowCells.some(c => c.includes('ชื่อวิชา') || c.includes('รายวิชา') || c.includes('coursename'));
    if (hasCode && hasName) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return items;

  const headers = rows[headerRowIdx].map(h => normalizeText(h));
  const idxFaculty = headers.findIndex(h => h.includes('คณะ'));
  const idxMajor = headers.findIndex(h => h.includes('สาขา') || h.includes('หลักสูตร'));
  const idxCode = headers.findIndex(h => h.includes('รหัสวิชา') || h === 'รหัส');
  const idxName = headers.findIndex(h => h.includes('ชื่อวิชา') || h.includes('รายวิชา'));
  const idxSection = headers.findIndex(h => h.includes('กลุ่มเรียน') || h.includes('กลุ่ม') || h.includes('sec'));
  const idxLecturer = headers.findIndex(h => h.includes('ผู้สอน') || h.includes('อาจารย์'));
  const idxRecCount = headers.findIndex(h => h.includes('จำนวนครั้ง') || h.includes('เก็บคะแนน'));
  const idxPlanCol = headers.findIndex(h => h.includes('แผน') || h.includes('ประเภท'));
  // อ่านคอลัมน์สถานะจริงจาก Excel ('บันทึก' / 'ไม่บันทึก') แบบตรงตัว
  const idxRecordedCol = headers.findIndex(h => h === 'บันทึก' || h === 'สถานะการบันทึก');
  const idxUnrecordedCol = headers.findIndex(h => h === 'ไม่บันทึก' || h === 'ไม่ได้บันทึก');

  let lastFaculty = '';
  let lastMajor = '';
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const rawCode = idxCode >= 0 ? String(r[idxCode] ?? '').trim() : '';
    const rawName = idxName >= 0 ? String(r[idxName] ?? '').trim() : '';
    if (!rawCode && !rawName) continue;
    if (rawCode.includes('รวม') || rawName.includes('รวม') || rawCode.includes('รหัสวิชา')) continue;

    const rawFac = idxFaculty >= 0 ? String(r[idxFaculty] ?? '').trim() : '';
    const rawMaj = idxMajor >= 0 ? String(r[idxMajor] ?? '').trim() : '';
    if (rawFac) lastFaculty = rawFac;
    if (rawMaj) lastMajor = rawMaj;

    let rowCourseType = courseType;
    if (!rowCourseType && idxPlanCol >= 0) {
      const planVal = String(r[idxPlanCol] ?? '').trim();
      rowCourseType = planVal.includes('นอกแผน') ? 'OUT_OF_PLAN' : 'IN_PLAN';
    }
    if (!rowCourseType) rowCourseType = 'IN_PLAN';

    const recCount = idxRecCount >= 0 ? Number(r[idxRecCount]) || 0 : 0;
    const rawSection = idxSection >= 0 ? String(r[idxSection] ?? '').trim() || '-' : '-';

    // กำหนดสถานะจากข้อมูลต้นฉบับเท่านั้น ไม่คาดเดาสถานะเอง
    let status = null;
    if (forceStatus) {
      status = forceStatus;
    } else if (idxRecordedCol >= 0 || idxUnrecordedCol >= 0) {
      const recCell = idxRecordedCol >= 0 ? String(r[idxRecordedCol] ?? '').trim() : '';
      const unrecCell = idxUnrecordedCol >= 0 ? String(r[idxUnrecordedCol] ?? '').trim() : '';
      const isRecFlag = recCell === '1' || recCell === 'บันทึกแล้ว';
      const isUnrecFlag = unrecCell === '1' || unrecCell === 'ไม่บันทึก' || unrecCell === 'ยังไม่บันทึก';

      if (isRecFlag && isUnrecFlag) {
        if (conflictLog) {
          conflictLog.push(`ชีต "${sheetLabel}" แถวที่ ${i + 1}: ข้อมูลต้นทางขัดแย้งกัน (ระบุทั้งบันทึกและไม่บันทึก) — ${rawCode} กลุ่ม ${rawSection}`);
        }
        continue;
      } else if (isRecFlag) {
        status = 'RECORDED';
      } else if (isUnrecFlag || recCell === '0') {
        status = 'UNRECORDED';
      } else {
        if (conflictLog) {
          conflictLog.push(`ชีต "${sheetLabel}" แถวที่ ${i + 1}: ไม่พบค่าสถานะที่ชัดเจนในคอลัมน์บันทึก/ไม่บันทึก — ${rawCode} กลุ่ม ${rawSection}`);
        }
        continue;
      }
    } else {
      status = recCount > 0 ? 'RECORDED' : 'UNRECORDED';
    }

    items.push({
      courseType: rowCourseType,
      status,
      faculty: lastFaculty || 'ไม่ระบุคณะ',
      major: lastMajor || 'ไม่ระบุสาขาวิชา',
      courseCode: rawCode,
      courseName: rawName,
      section: rawSection,
      lecturer: idxLecturer >= 0 ? String(r[idxLecturer] ?? '').trim() || 'ไม่ระบุผู้สอน' : 'ไม่ระบุผู้สอน',
      recordedCount: recCount
    });
  }
  return items;
}

function parseGovernanceSheetCount(sheet) {
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let count = 0;
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (r && r.some(cell => /^[A-Z]{2,5}\s*\d{3,5}/i.test(String(cell || '').trim()))) count++;
  }
  return count;
}

function parseWorkbookData(workbook, fileName) {
  const sheetSumIn = findSheet(workbook, ['สรุปการบันทึก (ตามแผน)', 'สรุปการบันทึก(ตามแผน)', 'สรุปตามแผน']);
  const sheetSumOut = findSheet(workbook, ['สรุปการบันทึก(นอกแผน)', 'สรุปการบันทึก (นอกแผน)', 'สรุปนอกแผน']);
  const sheetExcluded = findSheet(workbook, ['กลุ่มที่ได้รับยกเว้น', 'รายวิชาได้รับยกเว้น', 'ยกเว้น']);
  const sheetNotDue = findSheet(workbook, ['ยังไม่ถึงกำหนดส่ง', 'ยังไม่ถึงกำหนด']);

  const inSummary = parseSummarySheet(sheetSumIn);
  const outSummary = parseSummarySheet(sheetSumOut);

  let rawDetailRecords = [];
  const conflictMessages = [];
  const skipPivotSheets = hasDedicatedDetailSheets(workbook);

  workbook.SheetNames.forEach(sheetName => {
    const norm = normalizeText(sheetName);

    if (
      norm.includes('สรุป') ||
      norm.includes('ยกเว้น') ||
      norm.includes('ยังไม่ถึงกำหนด')
    ) {
      return;
    }

    // ข้ามชีตสรุป Pivot ('รายงานการบันทึก...') เมื่อมีชีตข้อมูลรายกลุ่ม ('รายวิชาตามแผน' / 'รายวิชานอกแผน') อยู่แล้ว เพื่อไม่ให้นำข้อมูลซ้ำเข้าสู่ระบบ
    if (skipPivotSheets && norm.startsWith('รายงานการบันทึก')) {
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    let cType = null;
    if (norm.includes('นอกแผน')) cType = 'OUT_OF_PLAN';
    else if (norm.includes('ตามแผน')) cType = 'IN_PLAN';

    let fStatus = null;
    if (norm.includes('ไม่บันทึก') || norm.includes('ยังไม่บันทึก') || norm.includes('ค้าง')) {
      fStatus = 'UNRECORDED';
    } else if (norm.includes('บันทึกแล้ว') || (norm.includes('บันทึก') && !norm.includes('ไม่บันทึก') && !norm.startsWith('รายงานการบันทึก'))) {
      fStatus = 'RECORDED';
    }

    const parsed = parseDetailSheet(sheet, cType, fStatus, conflictMessages, sheetName);
    if (parsed.length > 0) {
      rawDetailRecords.push(...parsed);
    }
  });

  // ตรวจสอบความขัดแย้งของสถานะในระดับรหัสวิชา + กลุ่มเรียน + ผู้สอน (หากพบข้อมูลขัดแย้งกัน ให้รายงานและหยุดกำหนดสถานะเอง)
  const recordStatusMap = new Map();
  const conflictedKeys = new Set();

  rawDetailRecords.forEach(r => {
    const key = `${r.courseType}|${r.courseCode}|${r.section}|${r.lecturer}`;
    if (!recordStatusMap.has(key)) {
      recordStatusMap.set(key, r.status);
    } else if (recordStatusMap.get(key) !== r.status) {
      conflictedKeys.add(key);
      conflictMessages.push(
        `ข้อมูลต้นทางขัดแย้งกัน: ${r.courseCode} ${r.courseName} กลุ่ม ${r.section} (${r.lecturer}) ปรากฏทั้งสถานะบันทึกแล้วและยังไม่บันทึก`
      );
    }
  });

  const detailRecords = rawDetailRecords.filter(r => {
    const key = `${r.courseType}|${r.courseCode}|${r.section}|${r.lecturer}`;
    return !conflictedKeys.has(key);
  });

  appState.hasLoadedData = true;
  appState.inPlanSummary = inSummary;
  appState.outOfPlanSummary = outSummary;
  appState.detailRecords = detailRecords;
  appState.excludedCount = parseGovernanceSheetCount(sheetExcluded);
  appState.notDueCount = parseGovernanceSheetCount(sheetNotDue);

  if (inSummary.titleMain) appState.reportTitleMain = inSummary.titleMain;
  if (inSummary.roundLabel) appState.reportRoundLabel = inSummary.roundLabel;
  if (inSummary.dateLabel) appState.reportDateLabel = inSummary.dateLabel;

  const statusPillText = document.getElementById('processingStatusText');
  if (statusPillText) statusPillText.textContent = `นำเข้าสำเร็จ: ${fileName}`;
  const statusDot = document.querySelector('#dataStatusPill .status-dot');
  if (statusDot) {
    statusDot.style.backgroundColor = '#269C79';
    statusDot.style.boxShadow = '0 0 0 3px rgba(38, 156, 121, 0.28)';
  }
  const guidanceBanner = document.getElementById('guidanceBanner');
  if (guidanceBanner) guidanceBanner.style.display = 'none';

  populateFilterDropdowns();
  renderAllViews();

  if (conflictMessages.length > 0) {
    console.warn('Source data conflicts detected:', conflictMessages);
    showToast(
      `พบข้อมูลต้นทางขัดแย้งกัน ${conflictMessages.length} รายการ (หยุดการกำหนดสถานะเองสำหรับรายการที่ขัดแย้ง กรุณาตรวจสอบใน Console)`,
      true
    );
  } else if (detailRecords.length === 0) {
    showToast(
      `อ่านชีตสรุปได้แล้ว แต่ไม่พบตารางรายกลุ่มในชีตย่อย (ชื่อชีตที่พบ: ${workbook.SheetNames.join(', ')})`,
      true
    );
  } else {
    showToast(`นำเข้าข้อมูลสำเร็จ (${detailRecords.length.toLocaleString()} กลุ่มเรียน)`);
  }
}

// ==================== RENDER ALL VIEWS ====================
function renderAllViews() {
  renderOverviewPage();
  renderPage2FacultyAnalysis();
  renderPage3LecturerAnalysis();
}

// ==================== PAGE 1: UNIVERSITY OVERVIEW ====================
function renderOverviewPage() {
  setText('activeTermBadge', appState.reportTitleMain);
  setText('activeRoundChip', appState.reportRoundLabel);
  setText('lastUpdatedText', appState.reportDateLabel);
  setText(
    'excludedGovernanceText',
    `คัดแยกกลุ่มเรียนที่ได้รับยกเว้น (${appState.excludedCount} กลุ่ม) และยังไม่ถึงกำหนดส่ง (${appState.notDueCount} กลุ่ม) ออกจากฐานคำนวณแล้ว`
  );

  // อัปเดตตัวเลขและวันที่ใน Footer Watermark ด้านล่างหน้าเว็บ
  setText('footerExcludedCount', appState.excludedCount.toLocaleString());
  setText('footerNotDueCount', appState.notDueCount.toLocaleString());
  if (appState.hasLoadedData && appState.reportDateLabel) {
    setText('footerDateText', `• ${appState.reportDateLabel}`);
  }

  const inS = appState.inPlanSummary;
  setText('inSubjectCount', inS.subjectCount.toLocaleString());
  setText('inTotalGroups', inS.totalGroups.toLocaleString());
  setText('inRecordedGroups', inS.recordedGroups.toLocaleString());
  setText('inRecordedPct', `${inS.recordedPct.toFixed(2)}%`);
  setText('inRecordedPctSub', `${inS.recordedPct.toFixed(2)}%`);
  setText('inUnrecordedGroups', inS.unrecordedGroups.toLocaleString());
  setText('inUnrecordedPct', `${inS.unrecordedPct.toFixed(2)}%`);
  setText('inUnrecordedPctSub', `${inS.unrecordedPct.toFixed(2)}%`);
  const inBar = document.getElementById('inProgressBar');
  if (inBar) inBar.style.width = `${Math.min(100, Math.max(0, inS.recordedPct))}%`;
  setText('inTargetStatusText', inS.totalGroups === 0 ? 'รอข้อมูล' : inS.recordedPct >= 95 ? 'ผ่านเกณฑ์' : 'ต่ำกว่าเกณฑ์');

  const outS = appState.outOfPlanSummary;
  setText('outSubjectCount', outS.subjectCount.toLocaleString());
  setText('outTotalGroups', outS.totalGroups.toLocaleString());
  setText('outRecordedGroups', outS.recordedGroups.toLocaleString());
  setText('outRecordedPct', `${outS.recordedPct.toFixed(2)}%`);
  setText('outRecordedPctSub', `${outS.recordedPct.toFixed(2)}%`);
  setText('outUnrecordedGroups', outS.unrecordedGroups.toLocaleString());
  setText('outUnrecordedPct', `${outS.unrecordedPct.toFixed(2)}%`);
  setText('outUnrecordedPctSub', `${outS.unrecordedPct.toFixed(2)}%`);
  const outBar = document.getElementById('outProgressBar');
  if (outBar) outBar.style.width = `${Math.min(100, Math.max(0, outS.recordedPct))}%`;
  setText('outTargetStatusText', outS.totalGroups === 0 ? 'รอข้อมูล' : outS.recordedPct >= 95 ? 'ผ่านเกณฑ์' : 'ต่ำกว่าเกณฑ์');

  updateOverviewFacultyDropdown();
  renderOverviewInsightsAndDonut();
  renderOverviewFacultyTableOnly();
}

function renderOverviewInsightsAndDonut() {
  const summaryObj = appState.overviewReportType === 'IN_PLAN' ? appState.inPlanSummary : appState.outOfPlanSummary;
  const labelText = appState.overviewReportType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน';

  setText('donutSubtitle', `ฐานข้อมูล: ${labelText} • เปรียบเทียบบันทึกแล้ว vs ยังไม่บันทึก`);
  setText('donutTypeBadge', labelText);
  setText('donutCenterPct', `${summaryObj.recordedPct.toFixed(2)}%`);
  setText('donutRecCount', summaryObj.recordedGroups.toLocaleString());
  setText('donutRecPct', `${summaryObj.recordedPct.toFixed(2)}%`);
  setText('donutUnrecCount', summaryObj.unrecordedGroups.toLocaleString());
  setText('donutUnrecPct', `${summaryObj.unrecordedPct.toFixed(2)}%`);
  setText('donutTotalCount', `${summaryObj.totalGroups.toLocaleString()} กลุ่ม`);

  // Donut Chart
  const donutCanvas = document.getElementById('overviewDonutChart');
  if (donutCanvas && typeof Chart !== 'undefined') {
    if (appState.charts.overviewDonut) appState.charts.overviewDonut.destroy();
    const hasData = summaryObj.totalGroups > 0;
    appState.charts.overviewDonut = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels: ['บันทึกคะแนนเก็บแล้ว', 'ยังไม่บันทึกคะแนนเก็บ'],
        datasets: [
          {
            data: hasData ? [summaryObj.recordedGroups, summaryObj.unrecordedGroups] : [1, 0],
            backgroundColor: hasData ? ['#269C79', '#D59A32'] : ['#DCE4EE', '#DCE4EE'],
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: '#151830',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString()} กลุ่มเรียน`
            }
          }
        }
      }
    });
  }

  // Highlight Faculty with Most Pending Groups
  const faculties = [...(summaryObj.faculties || [])];
  const btnDrill = document.getElementById('btnDrillHighlightFaculty');
  if (faculties.length === 0) {
    appState.highlightFacultyName = '';
    setText('highlightFacultyName', 'รอการนำเข้าข้อมูล');
    setText('highlightFacultyDesc', 'ระบบจะระบุคณะที่มีจำนวนกลุ่มเรียนยังไม่บันทึกสูงสุดโดยอัตโนมัติ เพื่อให้ฝ่ายวิชาการติดตามได้ตรงจุด');
    setText('hlUnrecGroups', '0');
    setText('hlUnrecPct', '0.00% ของคณะ');
    setText('hlRecGroups', '0');
    setText('hlRecPct', '0.00% สำเร็จ');
    setText('hlTotalGroups', '0');
    setText('hlSubjectCount', '0 รายวิชา');
    if (btnDrill) btnDrill.disabled = true;
    return;
  }

  faculties.sort((a, b) => b.unrecordedGroups - a.unrecordedGroups || a.recordedPct - b.recordedPct);
  const topPending = faculties[0];
  appState.highlightFacultyName = topPending.faculty;

  setText('highlightFacultyName', topPending.faculty);
  setText(
    'highlightFacultyDesc',
    topPending.unrecordedGroups > 0
      ? `มีจำนวนกลุ่มเรียนค้างบันทึกสูงสุดในหมวด${labelText} (${topPending.unrecordedGroups.toLocaleString()} กลุ่ม จากทั้งหมด ${topPending.totalGroups.toLocaleString()} กลุ่ม)`
      : `ทุกคณะในหมวด${labelText} ดำเนินการบันทึกคะแนนเก็บครบถ้วน 100% แล้ว`
  );
  setText('hlUnrecGroups', topPending.unrecordedGroups.toLocaleString());
  setText('hlUnrecPct', `${topPending.unrecordedPct.toFixed(2)}% ของคณะ`);
  setText('hlRecGroups', topPending.recordedGroups.toLocaleString());
  setText('hlRecPct', `${topPending.recordedPct.toFixed(2)}% สำเร็จ`);
  setText('hlTotalGroups', topPending.totalGroups.toLocaleString());
  setText('hlSubjectCount', `${topPending.subjectCount.toLocaleString()} รายวิชา`);
  if (btnDrill) btnDrill.disabled = false;
}

function updateOverviewFacultyDropdown() {
  const select = document.getElementById('overviewFacultySelect');
  if (!select) return;

  const summaryObj = appState.overviewReportType === 'IN_PLAN' ? appState.inPlanSummary : appState.outOfPlanSummary;
  const faculties = (summaryObj.faculties || []).map(f => f.faculty);
  const prevVal = select.value;

  select.innerHTML =
    `<option value="ALL">แสดงทุกคณะ (${faculties.length} คณะ)</option>` +
    faculties.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

  if (faculties.includes(prevVal)) {
    select.value = prevVal;
  }
}

function setOverviewReportType(typeKey) {
  appState.overviewReportType = typeKey;
  document.querySelectorAll('.type-toggle-btn[data-ctype]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ctype === typeKey);
  });
  const isInPlan = typeKey === 'IN_PLAN';
  const labelText = isInPlan ? 'ตามแผน' : 'นอกแผน';
  const tagClass = isInPlan ? 'section-tag tag-steel' : 'section-tag tag-navy';

  const donutBadge = document.getElementById('donutTypeBadge');
  if (donutBadge) {
    donutBadge.textContent = labelText;
    donutBadge.className = tagClass;
  }
  setText('overviewTableTypeLabel', labelText);

  updateOverviewFacultyDropdown();
  renderOverviewInsightsAndDonut();
  renderOverviewFacultyTableOnly();
}

// ==================== CUSTOM MODERN CHART PLUGINS (FOR PAGE 2) ====================
const modernChartBgPlugin = {
  id: 'modernChartBgPlugin',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const bgMode = chart.options.plugins?.modernBg?.mode;
    if (!bgMode || !chartArea || !scales.y) return;

    ctx.save();
    const yScale = scales.y;

    if (bgMode === 'zebraRows') {
      const count = yScale.ticks.length;
      for (let i = 0; i < count; i++) {
        if (i % 2 === 0) {
          const yCenter = yScale.getPixelForTick(i);
          const step =
            count > 1
              ? Math.abs(yScale.getPixelForTick(1) - yScale.getPixelForTick(0))
              : chartArea.bottom - chartArea.top;
          const top = Math.max(chartArea.top, yCenter - step / 2);
          const bottom = Math.min(chartArea.bottom, yCenter + step / 2);

          ctx.fillStyle = 'rgba(233, 239, 245, 0.55)';
          ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
        }
      }
    }
    ctx.restore();
  }
};

const endBarLabelsPlugin = {
  id: 'endBarLabelsPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const mode = chart.options.plugins?.endBarLabels?.mode;
    if (!mode) return;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    if (mode === 'groupedCount') {
      chart.data.datasets.forEach((dataset, dsIndex) => {
        const meta = chart.getDatasetMeta(dsIndex);
        if (!meta || meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const val = Number(dataset.data[i]) || 0;
          if (val === 0) {
            ctx.font = "600 10.5px 'Sarabun', sans-serif";
            ctx.fillStyle = '#94A3B8';
          } else {
            ctx.font = "700 11.5px 'Sarabun', sans-serif";
            ctx.fillStyle = dsIndex === 0 ? '#1D7E61' : '#B47D1E';
          }
          ctx.fillText(val.toLocaleString(), bar.x + 7, bar.y);
        });
      });
    }
    ctx.restore();
  }
};

function createHorizontalGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 520, 0);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

// ==================== SECTION 02 (PAGE 2): FACULTY SUMMARY TABLE ====================
function sortOverviewTable(key) {
  if (appState.overviewSort.key === key) {
    appState.overviewSort.dir = appState.overviewSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    appState.overviewSort.key = key;
    appState.overviewSort.dir = key === 'faculty' || key === 'order' ? 'asc' : 'desc';
  }
  renderOverviewFacultyTableOnly();
}

function renderOverviewFacultyTableOnly() {
  const tbody = document.getElementById('tbodyOverviewFacultySummary');
  const tfoot = document.getElementById('tfootOverviewFacultySummary');
  if (!tbody) return;

  const activeType =
    document.getElementById('page-faculty')?.style.display !== 'none'
      ? appState.page2CourseType
      : appState.overviewReportType;

  const summaryObj = activeType === 'IN_PLAN' ? appState.inPlanSummary : appState.outOfPlanSummary;
  const selectedFaculty = document.getElementById('overviewFacultySelect')?.value || 'ALL';
  const statusFilter = document.getElementById('overviewStatusFilterSelect')?.value || 'ALL';

  let rows = [...(summaryObj.faculties || [])];

  if (selectedFaculty !== 'ALL') {
    rows = rows.filter(r => r.faculty === selectedFaculty);
  }

  if (statusFilter === 'HAS_UNRECORDED') {
    rows = rows.filter(r => r.unrecordedGroups > 0);
  } else if (statusFilter === 'COMPLETED_100') {
    rows = rows.filter(r => r.unrecordedGroups === 0 && r.totalGroups > 0);
  } else if (statusFilter === 'BELOW_95') {
    rows = rows.filter(r => r.recordedPct < 95);
  }

  const { key, dir } = appState.overviewSort;
  rows.sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (typeof valA === 'string') return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    return dir === 'asc' ? valA - valB : valB - valA;
  });

  setText('overviewFacultyRowCount', rows.length.toLocaleString());
  setText('overviewTableTypeLabel', activeType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-cell">${
      appState.hasLoadedData
        ? 'ไม่พบข้อมูลคณะที่ตรงตามเงื่อนไขที่เลือก'
        : 'ยังไม่มีข้อมูลในระบบ กรุณากดปุ่ม "นำเข้าไฟล์ Excel" ด้านบน'
    }</td></tr>`;
    if (tfoot) tfoot.style.display = 'none';
    return;
  }

  tbody.innerHTML = rows
    .map(
      r => `
    <tr>
      <td style="text-align: center;">${r.order}</td>
      <td>
        <a class="link-drill" onclick="drillToFaculty('${escapeHtml(r.faculty).replace(/'/g, "\\'")}', '${activeType}')">
          ${escapeHtml(r.faculty)}
        </a>
      </td>
      <td style="text-align: center;">${r.subjectCount.toLocaleString()}</td>
      <td style="text-align: center;">${r.totalGroups.toLocaleString()}</td>
      <td style="text-align: center;" class="col-rec">${r.recordedGroups.toLocaleString()}</td>
      <td style="text-align: center;" class="col-rec">${r.recordedPct.toFixed(2)}%</td>
      <td style="text-align: center;" class="col-unrec">${r.unrecordedGroups.toLocaleString()}</td>
      <td style="text-align: center;" class="col-unrec">${r.unrecordedPct.toFixed(2)}%</td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="drillToFaculty('${escapeHtml(r.faculty).replace(/'/g, "\\'")}', '${activeType}')">
          ดูสาขาวิชา
        </button>
      </td>
    </tr>
  `
    )
    .join('');

  if (tfoot) {
    tfoot.style.display = '';
    const isUnfiltered = selectedFaculty === 'ALL' && statusFilter === 'ALL';
    const sumSubj = isUnfiltered ? summaryObj.subjectCount : rows.reduce((s, r) => s + r.subjectCount, 0);
    const sumTot = isUnfiltered ? summaryObj.totalGroups : rows.reduce((s, r) => s + r.totalGroups, 0);
    const sumRec = isUnfiltered ? summaryObj.recordedGroups : rows.reduce((s, r) => s + r.recordedGroups, 0);
    const sumUnrec = isUnfiltered ? summaryObj.unrecordedGroups : rows.reduce((s, r) => s + r.unrecordedGroups, 0);
    const sumRecPct = isUnfiltered ? summaryObj.recordedPct : sumTot > 0 ? (sumRec / sumTot) * 100 : 0;
    const sumUnrecPct = isUnfiltered ? summaryObj.unrecordedPct : sumTot > 0 ? (sumUnrec / sumTot) * 100 : 0;

    setText('sumColSubjects', sumSubj.toLocaleString());
    setText('sumColTotalGroups', sumTot.toLocaleString());
    setText('sumColRecordedGroups', sumRec.toLocaleString());
    setText('sumColRecordedPct', `${sumRecPct.toFixed(2)}%`);
    setText('sumColUnrecordedGroups', sumUnrec.toLocaleString());
    setText('sumColUnrecordedPct', `${sumUnrecPct.toFixed(2)}%`);
  }
}

function exportOverviewSummaryExcel() {
  const activeType =
    document.getElementById('page-faculty')?.style.display !== 'none'
      ? appState.page2CourseType
      : appState.overviewReportType;

  const summaryObj = activeType === 'IN_PLAN' ? appState.inPlanSummary : appState.outOfPlanSummary;
  if (!summaryObj.faculties || summaryObj.faculties.length === 0) {
    showToast('ยังไม่มีข้อมูลสำหรับส่งออก กรุณานำเข้าไฟล์ Excel ก่อน', true);
    return;
  }
  const typeLabel = activeType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน';
  const exportRows = summaryObj.faculties.map(r => ({
    ลำดับ: r.order,
    คณะ: r.faculty,
    จำนวนรายวิชาที่ต้องบันทึกคะแนนเก็บ: r.subjectCount,
    จำนวนกลุ่มที่ต้องบันทึกคะแนนเก็บ: r.totalGroups,
    จำนวนกลุ่มที่บันทึกคะแนนเก็บแล้ว: r.recordedGroups,
    ร้อยละของจำนวนกลุ่มที่บันทึกคะแนนเก็บ: Number(r.recordedPct.toFixed(2)),
    จำนวนกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ: r.unrecordedGroups,
    ร้อยละกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ: Number(r.unrecordedPct.toFixed(2))
  }));
  exportRows.push({
    ลำดับ: '',
    คณะ: 'รวม',
    จำนวนรายวิชาที่ต้องบันทึกคะแนนเก็บ: summaryObj.subjectCount,
    จำนวนกลุ่มที่ต้องบันทึกคะแนนเก็บ: summaryObj.totalGroups,
    จำนวนกลุ่มที่บันทึกคะแนนเก็บแล้ว: summaryObj.recordedGroups,
    ร้อยละของจำนวนกลุ่มที่บันทึกคะแนนเก็บ: Number(summaryObj.recordedPct.toFixed(2)),
    จำนวนกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ: summaryObj.unrecordedGroups,
    ร้อยละกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ: Number(summaryObj.unrecordedPct.toFixed(2))
  });
  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `สรุป_${typeLabel}`);
  XLSX.writeFile(wb, `สรุปการบันทึกคะแนนเก็บ_${typeLabel}.xlsx`);
  showToast(`ส่งออกตารางสรุป (${typeLabel}) เป็นไฟล์ Excel เรียบร้อยแล้ว`);
}

// ==================== PAGE 2: FACULTY & PROGRAM ANALYSIS ====================
function populateFilterDropdowns() {
  updateOverviewFacultyDropdown();
  updatePage2FacultyOptions();
  updatePage3FacultyAndMajorOptions();
  updateLecturerDropdownOptions();
}

function updatePage2FacultyOptions() {
  const facSelect = document.getElementById('p2FacultySelect');
  if (!facSelect) return;
  const scoped = appState.detailRecords.filter(r => r.courseType === appState.page2CourseType);
  const faculties = [...new Set(scoped.map(r => r.faculty))].sort((a, b) => a.localeCompare(b, 'th'));
  const prevVal = facSelect.value;
  facSelect.innerHTML =
    `<option value="ALL">ทุกคณะ (${faculties.length} คณะ)</option>` +
    faculties.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  if (faculties.includes(prevVal)) facSelect.value = prevVal;
  updatePage2MajorOptions();
}

function updatePage2MajorOptions() {
  const facSelect = document.getElementById('p2FacultySelect');
  const majSelect = document.getElementById('p2MajorSelect');
  if (!facSelect || !majSelect) return;
  const selFac = facSelect.value;
  let scoped = appState.detailRecords.filter(r => r.courseType === appState.page2CourseType);
  if (selFac !== 'ALL') scoped = scoped.filter(r => r.faculty === selFac);
  const majors = [...new Set(scoped.map(r => r.major))].sort((a, b) => a.localeCompare(b, 'th'));
  const prevMaj = majSelect.value;
  majSelect.innerHTML =
    `<option value="ALL">ทุกสาขาวิชา (${majors.length} สาขา)</option>` +
    majors.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (majors.includes(prevMaj)) majSelect.value = prevMaj;
}

function setPage2CourseType(typeKey) {
  appState.page2CourseType = typeKey;
  document.querySelectorAll('.seg-type-btn[data-p2type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.p2type === typeKey);
  });
  const isInPlan = typeKey === 'IN_PLAN';
  const badge = document.getElementById('p2ActiveTypeBadge');
  if (badge) {
    badge.textContent = isInPlan ? 'ประเภทข้อมูล: ตามแผน' : 'ประเภทข้อมูล: นอกแผน';
    badge.className = isInPlan ? 'section-tag tag-steel' : 'section-tag tag-navy';
  }
  setText('p2TypeFootnote', isInPlan ? 'ประเภท: ตามแผน' : 'ประเภท: นอกแผน');
  updatePage2FacultyOptions();
  renderOverviewFacultyTableOnly();
  renderPage2FacultyAnalysis();
}

function selectPage2CardView(viewKey) {
  appState.page2CardView = viewKey;

  // อัปเดตสถานะ Active บน Card ทั้ง 4 ใบ
  ['ALL', 'RECORDED', 'UNRECORDED', 'SUCCESS'].forEach(k => {
    const cardEl = document.getElementById(`p2Card-${k}`);
    if (cardEl) cardEl.classList.toggle('active-kpi-card', k === viewKey);
  });

  // ซิงค์ค่า Dropdown ข้อ 4 ให้สอดคล้องกัน
  const statusSelect = document.getElementById('p2StatusSelect');
  if (statusSelect) {
    if (viewKey === 'RECORDED') statusSelect.value = 'RECORDED';
    else if (viewKey === 'UNRECORDED') statusSelect.value = 'UNRECORDED';
    else statusSelect.value = 'ALL';
  }

  renderPage2FacultyAnalysis();
}

function onPage2StatusDropdownChange() {
  const val = document.getElementById('p2StatusSelect')?.value || 'ALL';
  if (val === 'RECORDED') selectPage2CardView('RECORDED');
  else if (val === 'UNRECORDED') selectPage2CardView('UNRECORDED');
  else selectPage2CardView('ALL');
}

function onPage2FacultyChange() {
  updatePage2MajorOptions();
  const selFac = document.getElementById('p2FacultySelect')?.value || 'ALL';
  // หากเลือกเฉพาะคณะใดคณะหนึ่ง ให้เปิดดูตารางสรุปรายสาขาวิชาโดยอัตโนมัติ
  if (selFac !== 'ALL' && appState.page2CardView === 'ALL') {
    selectPage2CardView('SUCCESS');
  } else {
    renderPage2FacultyAnalysis();
  }
  if (document.getElementById('page-faculty')?.style.display !== 'none') {
    updateDrilldownBreadcrumb('faculty');
  }
}

function resetPage2Filters() {
  const facSelect = document.getElementById('p2FacultySelect');
  const majSelect = document.getElementById('p2MajorSelect');
  const statusSelect = document.getElementById('p2StatusSelect');
  if (facSelect) facSelect.value = 'ALL';
  updatePage2MajorOptions();
  if (majSelect) majSelect.value = 'ALL';
  if (statusSelect) statusSelect.value = 'ALL';
  if (document.getElementById('searchUnrecordedInput')) document.getElementById('searchUnrecordedInput').value = '';
  if (document.getElementById('searchRecordedInput')) document.getElementById('searchRecordedInput').value = '';
  selectPage2CardView('ALL');
  updateDrilldownBreadcrumb('faculty');
}

function sortPage2Table(tableType, key) {
  const st = appState.page2Sort[tableType];
  st.dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
  st.key = key;
  renderPage2FacultyAnalysis();
}

function renderPage2FacultyAnalysis() {
  const selFac = document.getElementById('p2FacultySelect')?.value || 'ALL';
  const selMaj = document.getElementById('p2MajorSelect')?.value || 'ALL';
  const qUnrec = (document.getElementById('searchUnrecordedInput')?.value || '').trim().toLowerCase();
  const qRec = (document.getElementById('searchRecordedInput')?.value || '').trim().toLowerCase();

  const typeLabel = appState.page2CourseType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน';
  const bc = document.getElementById('p2ScopeBreadcrumb');
  if (bc) {
    bc.innerHTML = `ขอบเขตข้อมูลปัจจุบัน: <strong>${typeLabel}</strong> • ${escapeHtml(
      selFac === 'ALL' ? 'ทุกคณะ' : selFac
    )} • ${escapeHtml(selMaj === 'ALL' ? 'ทุกสาขาวิชา' : selMaj)}`;
  }

  let scoped = appState.detailRecords.filter(r => r.courseType === appState.page2CourseType);
  if (selFac !== 'ALL') scoped = scoped.filter(r => r.faculty === selFac);
  if (selMaj !== 'ALL') scoped = scoped.filter(r => r.major === selMaj);

  const unrecAll = scoped.filter(r => r.status === 'UNRECORDED');
  const recAll = scoped.filter(r => r.status === 'RECORDED');

  // ยึดตัวเลขจากแถวรวมในชีตสรุป (ตามแผน / นอกแผน) เป็นหลัก เพื่อให้ตรงกับฐานข้อมูลจริงของสำนักงานวิชาการ
  const summaryObj = appState.page2CourseType === 'IN_PLAN' ? appState.inPlanSummary : appState.outOfPlanSummary;
  let totalCount = scoped.length;
  let recordedCount = recAll.length;
  let unrecordedCount = unrecAll.length;
  let recPct = totalCount > 0 ? (recordedCount / totalCount) * 100 : 0;
  let unrecPct = totalCount > 0 ? (unrecordedCount / totalCount) * 100 : 0;

  if (selFac === 'ALL' && selMaj === 'ALL' && summaryObj.totalGroups > 0) {
    totalCount = summaryObj.totalGroups;
    recordedCount = summaryObj.recordedGroups;
    unrecordedCount = summaryObj.unrecordedGroups;
    recPct = summaryObj.recordedPct;
    unrecPct = summaryObj.unrecordedPct;
  } else if (selFac !== 'ALL' && selMaj === 'ALL' && summaryObj.faculties?.length > 0) {
    const facRow = summaryObj.faculties.find(f => f.faculty === selFac);
    if (facRow) {
      totalCount = facRow.totalGroups;
      recordedCount = facRow.recordedGroups;
      unrecordedCount = facRow.unrecordedGroups;
      recPct = facRow.recordedPct;
      unrecPct = facRow.unrecordedPct;
    }
  }

  setText('p2TotalCount', totalCount.toLocaleString());
  setText('p2RecordedCount', recordedCount.toLocaleString());
  setText('p2RecordedPctText', `${recPct.toFixed(2)}%`);
  setText('p2UnrecordedCount', unrecordedCount.toLocaleString());
  setText('p2UnrecordedPctText', `${unrecPct.toFixed(2)}%`);
  setText('p2SuccessRate', `${recPct.toFixed(2)}%`);
  const p2Bar = document.getElementById('p2ProgressBar');
  if (p2Bar) p2Bar.style.width = `${Math.min(100, Math.max(0, recPct))}%`;

  // เตรียมข้อมูลตารางทั้งหมด
  renderOverviewFacultyTableOnly();
  renderProgramSummaryTable(scoped);

  let filteredUnrec = qUnrec
    ? unrecAll.filter(r =>
        `${r.courseCode} ${r.courseName} ${r.faculty} ${r.major} ${r.lecturer} ${r.section}`
          .toLowerCase()
          .includes(qUnrec)
      )
    : unrecAll;
  filteredUnrec = sortRecords(filteredUnrec, appState.page2Sort.unrecorded);
  setText('tbl1Count', filteredUnrec.length.toLocaleString());
  renderPage2DetailTbody('tbodyUnrecorded', filteredUnrec, true);

  let filteredRec = qRec
    ? recAll.filter(r =>
        `${r.courseCode} ${r.courseName} ${r.faculty} ${r.major} ${r.lecturer} ${r.section}`
          .toLowerCase()
          .includes(qRec)
      )
    : recAll;
  filteredRec = sortRecords(filteredRec, appState.page2Sort.recorded);
  setText('tbl2Count', filteredRec.length.toLocaleString());
  renderPage2DetailTbody('tbodyRecorded', filteredRec, false);

  // ควบคุมการแสดงผลตารางตาม Card ที่เลือก
  const view = appState.page2CardView || 'ALL';
  const facWrapper = document.getElementById('p2FacultySummaryWrapper');
  const chartPanel = document.getElementById('p2MajorChartPanel');
  const progWrapper = document.getElementById('p2ProgramSummaryWrapper');
  const unrecWrapper = document.getElementById('p2UnrecordedWrapper');
  const recWrapper = document.getElementById('p2RecordedWrapper');

  // ซ่อนทั้งหมดก่อน แล้วเปิดเฉพาะส่วนของ Card ที่เลือก
  if (facWrapper) facWrapper.style.display = 'none';
  if (chartPanel) chartPanel.style.display = 'none';
  if (progWrapper) progWrapper.style.display = 'none';
  if (unrecWrapper) unrecWrapper.style.display = 'none';
  if (recWrapper) recWrapper.style.display = 'none';

  if (view === 'ALL') {
    // Card 1: จำนวนกลุ่มเรียนทั้งหมด -> แสดงตารางสรุปรายคณะ
    if (facWrapper) facWrapper.style.display = 'block';
  } else if (view === 'RECORDED') {
    // Card 2: บันทึกแล้ว -> แสดงเฉพาะตารางกลุ่มเรียนที่บันทึกแล้ว
    if (recWrapper) recWrapper.style.display = 'block';
  } else if (view === 'UNRECORDED') {
    // Card 3: ยังไม่บันทึก -> แสดงเฉพาะตารางกลุ่มเรียนที่ยังไม่บันทึก
    if (unrecWrapper) unrecWrapper.style.display = 'block';
  } else if (view === 'SUCCESS') {
    // Card 4: เปอร์เซ็นต์ความสำเร็จ -> แสดงกราฟและตารางสรุปรายสาขาวิชาเพื่อเจาะลึก
    renderPage2MajorChart(scoped, selFac);
    if (progWrapper) progWrapper.style.display = 'block';
  }
}

function renderProgramSummaryTable(scopedRecords) {
  const tbody = document.getElementById('tbodyProgramSummary');
  if (!tbody) return;

  if (!scopedRecords || scopedRecords.length === 0) {
    setText('p2MajorSummaryCount', '0 สาขา');
    tbody.innerHTML = `<tr><td colspan="8" class="empty-table-cell">ไม่พบข้อมูลสาขาวิชาตามเงื่อนไขที่เลือก</td></tr>`;
    return;
  }

  const progMap = new Map();
  scopedRecords.forEach(r => {
    const key = `${r.faculty}||${r.major}`;
    if (!progMap.has(key)) {
      progMap.set(key, { faculty: r.faculty, major: r.major, total: 0, recorded: 0, unrecorded: 0 });
    }
    const item = progMap.get(key);
    item.total++;
    if (r.status === 'RECORDED') item.recorded++;
    else item.unrecorded++;
  });

  const rows = [...progMap.values()]
    .map(item => ({
      ...item,
      pct: item.total > 0 ? (item.recorded / item.total) * 100 : 0
    }))
    .sort((a, b) => b.unrecorded - a.unrecorded || a.pct - b.pct);

  setText('p2MajorSummaryCount', `${rows.length.toLocaleString()} สาขา`);

  tbody.innerHTML = rows
    .map((r, idx) => {
      const barColor = r.pct >= 95 ? '#269C79' : r.pct >= 80 ? '#41658F' : '#D59A32';
      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${escapeHtml(r.faculty)}</td>
        <td>
          <a class="link-drill" onclick="drillToMajor('${escapeHtml(r.faculty).replace(/'/g, "\\'")}', '${escapeHtml(r.major).replace(/'/g, "\\'")}')">
            ${escapeHtml(r.major)}
          </a>
        </td>
        <td style="text-align: center;">${r.total.toLocaleString()}</td>
        <td style="text-align: center;" class="col-rec">${r.recorded.toLocaleString()}</td>
        <td style="text-align: center;" class="col-unrec">${r.unrecorded.toLocaleString()}</td>
        <td>
          <div class="tbl-progress-cell">
            <div class="tbl-progress-track">
              <div class="tbl-progress-fill" style="width: ${r.pct.toFixed(1)}%; background-color: ${barColor};"></div>
            </div>
            <strong style="font-size: 0.84rem; min-width: 52px; text-align: right;">${r.pct.toFixed(2)}%</strong>
          </div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="drillToProgramInstructors('${escapeHtml(r.faculty).replace(/'/g, "\\'")}', '${escapeHtml(r.major).replace(/'/g, "\\'")}')">
            ดูอาจารย์ในสาขา
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

function renderPage2MajorChart(scopedRecords, selFac) {
  const panel = document.getElementById('p2MajorChartPanel');
  const canvas = document.getElementById('p2MajorComparisonChart');
  const wrapper = document.getElementById('p2MajorChartWrapper');
  if (!panel || !canvas || typeof Chart === 'undefined') return;

  if (!scopedRecords || scopedRecords.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  const groupKey = selFac === 'ALL' ? 'faculty' : 'major';
  setText(
    'p2MajorChartTitle',
    selFac === 'ALL'
      ? 'เปรียบเทียบผลการบันทึกคะแนนเก็บแยกตามคณะ (ข้อมูลรายกลุ่ม)'
      : `เปรียบเทียบผลการบันทึกคะแนนเก็บแยกตามสาขาวิชา (${selFac})`
  );
  setText('p2MajorChartBadge', selFac === 'ALL' ? 'ภาพรวมรายคณะ' : 'รายสาขาวิชา');

  const groupMap = new Map();
  scopedRecords.forEach(r => {
    const key = r[groupKey] || 'ไม่ระบุ';
    if (!groupMap.has(key)) groupMap.set(key, { name: key, recorded: 0, unrecorded: 0, total: 0 });
    const entry = groupMap.get(key);
    entry.total++;
    if (r.status === 'RECORDED') entry.recorded++;
    else entry.unrecorded++;
  });

  const sortedGroups = [...groupMap.values()].sort((a, b) => b.total - a.total);
  if (wrapper) {
    wrapper.style.height = `${Math.max(260, sortedGroups.length * 36 + 70)}px`;
  }

  if (appState.charts.p2MajorChart) appState.charts.p2MajorChart.destroy();
  const ctx = canvas.getContext('2d');
  const gradGreen = createHorizontalGradient(ctx, '#34B890', '#269C79');
  const gradGold = createHorizontalGradient(ctx, '#E5B04B', '#D59A32');

  const maxVal = sortedGroups.reduce((m, g) => Math.max(m, g.recorded, g.unrecorded), 0);
  const suggestedMax = maxVal > 0 ? Math.ceil((maxVal * 1.18) / 5) * 5 : 10;

  appState.charts.p2MajorChart = new Chart(canvas, {
    type: 'bar',
    plugins: [modernChartBgPlugin, endBarLabelsPlugin],
    data: {
      labels: sortedGroups.map(g => (selFac === 'ALL' ? shortenFacultyName(g.name) : g.name)),
      datasets: [
        {
          label: 'บันทึกคะแนนเก็บแล้ว',
          data: sortedGroups.map(g => g.recorded),
          backgroundColor: gradGreen,
          borderRadius: { topRight: 5, bottomRight: 5 },
          barThickness: 10
        },
        {
          label: 'ยังไม่บันทึกคะแนนเก็บ',
          data: sortedGroups.map(g => g.unrecorded),
          backgroundColor: gradGold,
          borderRadius: { topRight: 5, bottomRight: 5 },
          barThickness: 10
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', axis: 'y', intersect: false },
      layout: { padding: { right: 26, top: 4 } },
      plugins: {
        modernBg: { mode: 'zebraRows' },
        endBarLabels: { mode: 'groupedCount' },
        legend: {
          position: 'top',
          align: 'start',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 9, font: { size: 12.5, weight: '700' } }
        },
        tooltip: {
          backgroundColor: '#151830',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: items => sortedGroups[items[0].dataIndex]?.name || '',
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toLocaleString()} กลุ่มเรียน`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax,
          border: { display: false },
          grid: { color: '#DCE4EE', drawTicks: false },
          ticks: { color: '#687394', font: { size: 11.5, weight: '600' } }
        },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: '#1E233B', font: { size: 12, weight: '600' } }
        }
      }
    }
  });
}

function renderPage2DetailTbody(tbodyId, rows, isUnrecorded) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-cell">${
      appState.hasLoadedData
        ? 'ไม่พบรายการกลุ่มเรียนตามเงื่อนไขที่เลือก'
        : 'ยังไม่มีข้อมูลในระบบ กรุณากดปุ่ม "นำเข้าไฟล์ Excel" ด้านบน'
    }</td></tr>`;
    return;
  }
  const codePillClass = isUnrecorded ? 'code-pill code-pill-danger' : 'code-pill code-pill-success';
  tbody.innerHTML = rows
    .map(
      r => `
    <tr>
      <td><span class="${codePillClass}">${escapeHtml(r.courseCode)}</span></td>
      <td><strong>${escapeHtml(r.courseName)}</strong></td>
      <td>${escapeHtml(r.faculty)}</td>
      <td>${escapeHtml(r.major)}</td>
      <td>
        <a class="link-drill" onclick="drillToInstructorDetail('${escapeHtml(r.lecturer).replace(/'/g, "\\'")}')">
          ${escapeHtml(r.lecturer)}
        </a>
      </td>
      <td style="text-align: center;"><span class="section-pill-cell">${escapeHtml(r.section)}</span></td>
    </tr>
  `
    )
    .join('');
}

function exportPage2FacultyExcel() {
  const selFac = document.getElementById('p2FacultySelect')?.value || 'ALL';
  const selMaj = document.getElementById('p2MajorSelect')?.value || 'ALL';
  let scoped = appState.detailRecords.filter(r => r.courseType === appState.page2CourseType);
  if (selFac !== 'ALL') scoped = scoped.filter(r => r.faculty === selFac);
  if (selMaj !== 'ALL') scoped = scoped.filter(r => r.major === selMaj);

  if (scoped.length === 0) {
    showToast('ไม่พบรายการข้อมูลสำหรับส่งออก', true);
    return;
  }

  const typeLabel = appState.page2CourseType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน';
  const exportRows = scoped.map((r, i) => ({
    ลำดับ: i + 1,
    สถานะการบันทึก: r.status === 'RECORDED' ? 'บันทึกแล้ว' : 'ไม่บันทึก',
    ประเภท: typeLabel,
    คณะตามสังกัดวิชา: r.faculty,
    สาขาวิชา: r.major,
    รหัสวิชา: r.courseCode,
    ชื่อวิชา: r.courseName,
    กลุ่มเรียน: r.section,
    ผู้สอน: r.lecturer
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายการกลุ่มเรียน');
  const fileTag = selFac === 'ALL' ? 'ทุกคณะ' : selFac.replace(/[\\/:*?"<>|]/g, '');
  XLSX.writeFile(wb, `รายละเอียดการบันทึก_${typeLabel}_${fileTag}.xlsx`);
  showToast(`ส่งออกข้อมูล ${scoped.length.toLocaleString()} รายการเรียบร้อยแล้ว`);
}

// ==================== PAGE 3: INDIVIDUAL INSTRUCTOR TRACKING ====================
function updatePage3FacultyAndMajorOptions() {
  const facSelect = document.getElementById('p3FacultyFilterSelect');
  if (facSelect) {
    const faculties = [...new Set(appState.detailRecords.map(r => r.faculty))]
      .filter(f => f && f !== 'ไม่ระบุคณะ')
      .sort((a, b) => a.localeCompare(b, 'th'));
    const prevFac = facSelect.value;
    facSelect.innerHTML =
      `<option value="ALL">ทุกคณะ (${faculties.length} คณะ)</option>` +
      faculties.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
    if (faculties.includes(prevFac)) facSelect.value = prevFac;
  }
  updatePage3MajorFilterOptions();
}

function updatePage3MajorFilterOptions() {
  const facSelect = document.getElementById('p3FacultyFilterSelect');
  const majSelect = document.getElementById('p3MajorFilterSelect');
  if (!majSelect) return;

  const selFac = facSelect?.value || 'ALL';
  let scoped = appState.detailRecords;
  if (selFac !== 'ALL') scoped = scoped.filter(r => r.faculty === selFac);

  const majors = [...new Set(scoped.map(r => r.major))]
    .filter(m => m && m !== 'ไม่ระบุสาขาวิชา')
    .sort((a, b) => a.localeCompare(b, 'th'));
  const prevMaj = majSelect.value;
  majSelect.innerHTML =
    `<option value="ALL">ทุกสาขาวิชา (${majors.length} สาขา)</option>` +
    majors.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (majors.includes(prevMaj)) majSelect.value = prevMaj;
}

function getFilteredInstructorSummaries() {
  const searchStr = (document.getElementById('p3LecturerSearchInput')?.value || '').trim().toLowerCase();
  const selFac = document.getElementById('p3FacultyFilterSelect')?.value || 'ALL';
  const selMaj = document.getElementById('p3MajorFilterSelect')?.value || 'ALL';
  const selStatus = document.getElementById('p3StatusFilterSelect')?.value || 'ALL';

  let scoped = appState.detailRecords.filter(r => r.lecturer && r.lecturer !== 'ไม่ระบุผู้สอน');
  if (selFac !== 'ALL') scoped = scoped.filter(r => r.faculty === selFac);
  if (selMaj !== 'ALL') scoped = scoped.filter(r => r.major === selMaj);

  const map = new Map();
  scoped.forEach(r => {
    if (!map.has(r.lecturer)) {
      map.set(r.lecturer, {
        lecturer: r.lecturer,
        faculties: new Set(),
        majors: new Set(),
        courses: new Set(),
        total: 0,
        recorded: 0,
        unrecorded: 0
      });
    }
    const item = map.get(r.lecturer);
    item.faculties.add(r.faculty);
    item.majors.add(r.major);
    item.courses.add(r.courseCode || r.courseName);
    item.total++;
    if (r.status === 'RECORDED') item.recorded++;
    else item.unrecorded++;
  });

  let list = [...map.values()].map(item => ({
    lecturer: item.lecturer,
    facultyText: [...item.faculties].join(', '),
    majorText: [...item.majors].join(', '),
    subjectCount: item.courses.size,
    total: item.total,
    recorded: item.recorded,
    unrecorded: item.unrecorded,
    pct: item.total > 0 ? (item.recorded / item.total) * 100 : 0
  }));

  if (searchStr) {
    list = list.filter(
      item =>
        item.lecturer.toLowerCase().includes(searchStr) ||
        item.facultyText.toLowerCase().includes(searchStr) ||
        item.majorText.toLowerCase().includes(searchStr)
    );
  }

  if (selStatus === 'HAS_PENDING') {
    list = list.filter(item => item.unrecorded > 0);
  } else if (selStatus === 'COMPLETED') {
    list = list.filter(item => item.unrecorded === 0 && item.total > 0);
  }

  list.sort((a, b) => b.unrecorded - a.unrecorded || a.pct - b.pct || a.lecturer.localeCompare(b.lecturer, 'th'));
  return list;
}

function updateLecturerDropdownOptions() {
  const select = document.getElementById('p3LecturerSelect');
  if (!select) return;

  const list = getFilteredInstructorSummaries();
  const sortedNames = [...list].sort((a, b) => a.lecturer.localeCompare(b.lecturer, 'th'));

  setText('p3TotalLecturersBadge', `รายชื่อผู้สอนตามตัวกรอง: ${sortedNames.length.toLocaleString()} ท่าน`);

  const prevVal = select.value;
  select.innerHTML =
    `<option value="">-- แสดงตารางสรุปอาจารย์ทั้งหมด (${sortedNames.length.toLocaleString()} ท่าน) --</option>` +
    sortedNames.map(l => `<option value="${escapeHtml(l.lecturer)}">${escapeHtml(l.lecturer)}</option>`).join('');

  if (sortedNames.some(l => l.lecturer === prevVal)) {
    select.value = prevVal;
  }
}

function onPage3FacultyFilterChange() {
  updatePage3MajorFilterOptions();
  updateLecturerDropdownOptions();
  renderPage3LecturerAnalysis();
}

function onPage3FilterChange() {
  const topVal = document.getElementById('p3StatusFilterSelect')?.value || 'ALL';
  const tableStatusSelect = document.getElementById('p3TableStatusFilterSelect');
  if (tableStatusSelect) {
    tableStatusSelect.value = topVal;
  }
  updateLecturerDropdownOptions();
  renderPage3LecturerAnalysis();
}

function onPage3TableStatusChange(val) {
  const topStatusSelect = document.getElementById('p3StatusFilterSelect');
  if (topStatusSelect) {
    topStatusSelect.value = val;
  }
  updateLecturerDropdownOptions();
  renderPage3LecturerAnalysis();
}

function clearSelectedInstructor() {
  const sel = document.getElementById('p3LecturerSelect');
  if (sel) sel.value = '';
  renderPage3LecturerAnalysis();
}

function resetPage3Lecturer() {
  if (document.getElementById('p3LecturerSearchInput')) document.getElementById('p3LecturerSearchInput').value = '';
  if (document.getElementById('p3FacultyFilterSelect')) document.getElementById('p3FacultyFilterSelect').value = 'ALL';
  updatePage3MajorFilterOptions();
  if (document.getElementById('p3MajorFilterSelect')) document.getElementById('p3MajorFilterSelect').value = 'ALL';
  if (document.getElementById('p3StatusFilterSelect')) document.getElementById('p3StatusFilterSelect').value = 'ALL';
  if (document.getElementById('p3TableStatusFilterSelect')) document.getElementById('p3TableStatusFilterSelect').value = 'ALL';
  updateLecturerDropdownOptions();
  if (document.getElementById('p3LecturerSelect')) document.getElementById('p3LecturerSelect').value = '';
  renderPage3LecturerAnalysis();
}

function sortPage3Table(tableKey, colKey) {
  const st = appState.page3Sort[tableKey];
  st.dir = st.key === colKey && st.dir === 'asc' ? 'desc' : 'asc';
  st.key = colKey;
  renderPage3LecturerAnalysis();
}

function renderInstructorDirectoryTable() {
  const tbody = document.getElementById('p3TbodyInstructorDirectory');
  if (!tbody) return;

  const list = getFilteredInstructorSummaries();
  setText('p3DirectoryCount', `${list.length.toLocaleString()} ท่าน`);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-cell">${
      appState.hasLoadedData
        ? 'ไม่พบรายชื่ออาจารย์ผู้สอนที่ตรงตามเงื่อนไขการค้นหา'
        : 'ยังไม่มีข้อมูลในระบบ กรุณากดปุ่ม "นำเข้าไฟล์ Excel" ด้านบน'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((item, idx) => {
      const isComplete = item.unrecorded === 0 && item.total > 0;
      const statusBadge = isComplete
        ? `<span class="kpi-pct-pill pill-green">บันทึกครบ 100%</span>`
        : `<span class="kpi-pct-pill pill-gold">ค้างบันทึก ${item.unrecorded} กลุ่ม</span>`;

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${escapeHtml(item.lecturer)}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.facultyText)}</div>
          <div style="font-size: 0.81rem; color: #687394;">${escapeHtml(item.majorText)}</div>
        </td>
        <td style="text-align: center;">${item.subjectCount.toLocaleString()}</td>
        <td style="text-align: center;">${item.total.toLocaleString()}</td>
        <td style="text-align: center;" class="col-rec">${item.recorded.toLocaleString()}</td>
        <td style="text-align: center;" class="col-unrec">${item.unrecorded.toLocaleString()}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-navy-solid btn-sm" onclick="drillToInstructorDetail('${escapeHtml(item.lecturer).replace(/'/g, "\\'")}')">
            ดูรายละเอียด
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

function renderPage3DetailTbody(tbodyId, rows, isUnrecorded) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-cell">ไม่พบรายการกลุ่มเรียนในหมวดหมู่นี้</td></tr>`;
    return;
  }
  const codePillClass = isUnrecorded ? 'code-pill code-pill-danger' : 'code-pill code-pill-success';
  tbody.innerHTML = rows
    .map(
      r => `
    <tr>
      <td><span class="${codePillClass}">${escapeHtml(r.courseCode)}</span></td>
      <td><strong>${escapeHtml(r.courseName)}</strong></td>
      <td>${escapeHtml(r.faculty)}</td>
      <td>${escapeHtml(r.major)}</td>
      <td style="text-align: center;"><span class="section-pill-cell">${escapeHtml(r.section)}</span></td>
    </tr>
  `
    )
    .join('');
}

function renderPage3LecturerAnalysis() {
  const selectedLecturer = document.getElementById('p3LecturerSelect')?.value || '';
  const dirSection = document.getElementById('p3InstructorDirectorySection');
  const detailContent = document.getElementById('p3LecturerDetailContent');
  const profileBanner = document.getElementById('p3LecturerProfileBanner');
  const exportBtn = document.getElementById('p3ExportBtn');

  if (document.getElementById('page-lecturer')?.style.display !== 'none') {
    updateDrilldownBreadcrumb('lecturer');
  }

  if (!selectedLecturer) {
    if (dirSection) dirSection.style.display = 'block';
    if (detailContent) detailContent.style.display = 'none';
    if (profileBanner) profileBanner.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
    renderInstructorDirectoryTable();
    return;
  }

  if (dirSection) dirSection.style.display = 'none';
  if (detailContent) detailContent.style.display = 'block';
  if (profileBanner) profileBanner.style.display = 'flex';
  if (exportBtn) exportBtn.style.display = 'inline-flex';

  const records = appState.detailRecords.filter(r => r.lecturer === selectedLecturer);
  setText(
    'p3LecturerAvatar',
    selectedLecturer.replace(/^(อาจารย์|ผศ\.|รศ\.|ศ\.|ดร\.|นาย|นาง|นางสาว)\s*/g, '').charAt(0) || 'อ'
  );
  setText('p3LecturerDisplayName', selectedLecturer);
  setText(
    'p3LecturerAffiliation',
    `คณะตามสังกัดวิชา: ${[...new Set(records.map(r => r.faculty))].join(', ') || '-'} • สาขาวิชา: ${
      [...new Set(records.map(r => r.major))].join(', ') || '-'
    }`
  );

  const inRecords = records.filter(r => r.courseType === 'IN_PLAN');
  const outRecords = records.filter(r => r.courseType === 'OUT_OF_PLAN');
  const total = records.length;
  const recorded = records.filter(r => r.status === 'RECORDED').length;
  const unrecorded = records.filter(r => r.status === 'UNRECORDED').length;
  const recPct = total > 0 ? (recorded / total) * 100 : 0;
  const unrecPct = total > 0 ? (unrecorded / total) * 100 : 0;

  setText('p3TotalCourses', total.toLocaleString());
  setText('p3SplitCountText', `ตามแผน ${inRecords.length} • นอกแผน ${outRecords.length}`);
  setText('p3RecordedCourses', recorded.toLocaleString());
  setText('p3RecordedShare', `${recPct.toFixed(2)}%`);
  setText('p3UnrecordedCourses', unrecorded.toLocaleString());
  setText('p3UnrecordedShare', `${unrecPct.toFixed(2)}%`);
  setText('p3SuccessPercent', `${recPct.toFixed(2)}%`);

  const verdict = document.getElementById('p3StatusVerdict');
  if (verdict) {
    verdict.textContent = unrecorded === 0 && total > 0 ? 'บันทึกครบถ้วน' : `คงค้าง ${unrecorded} กลุ่ม`;
    verdict.style.color = unrecorded === 0 && total > 0 ? '#1D7E61' : '#B47D1E';
  }
  const p3Bar = document.getElementById('p3ProgressBar');
  if (p3Bar) p3Bar.style.width = `${Math.min(100, Math.max(0, recPct))}%`;

  const inUnrec = sortRecords(inRecords.filter(r => r.status === 'UNRECORDED'), appState.page3Sort.inUnrec);
  const inRec = sortRecords(inRecords.filter(r => r.status === 'RECORDED'), appState.page3Sort.inRec);
  setText('p3InPlanSummarySub', `ทั้งหมด ${inRecords.length} กลุ่มเรียน • บันทึกแล้ว ${inRec.length} • ยังไม่บันทึก ${inUnrec.length}`);
  setText('p3InUnrecCount', inUnrec.length.toLocaleString());
  setText('p3InRecCount', inRec.length.toLocaleString());
  renderPage3DetailTbody('p3TbodyInUnrec', inUnrec, true);
  renderPage3DetailTbody('p3TbodyInRec', inRec, false);

  const outUnrec = sortRecords(outRecords.filter(r => r.status === 'UNRECORDED'), appState.page3Sort.outUnrec);
  const outRec = sortRecords(outRecords.filter(r => r.status === 'RECORDED'), appState.page3Sort.outRec);
  setText(
    'p3OutPlanSummarySub',
    `ทั้งหมด ${outRecords.length} กลุ่มเรียน • บันทึกแล้ว ${outRec.length} • ยังไม่บันทึก ${outUnrec.length}`
  );
  setText('p3OutUnrecCount', outUnrec.length.toLocaleString());
  setText('p3OutRecCount', outRec.length.toLocaleString());
  renderPage3DetailTbody('p3TbodyOutUnrec', outUnrec, true);
  renderPage3DetailTbody('p3TbodyOutRec', outRec, false);
}

function exportPage3LecturerExcel() {
  const selectedLecturer = document.getElementById('p3LecturerSelect')?.value || '';
  if (!selectedLecturer) return;

  const records = appState.detailRecords.filter(r => r.lecturer === selectedLecturer);
  if (records.length === 0) {
    showToast('ไม่พบข้อมูลสำหรับส่งออก', true);
    return;
  }

  const exportRows = records.map((r, i) => ({
    ลำดับ: i + 1,
    ผู้สอน: r.lecturer,
    ประเภทรายวิชา: r.courseType === 'IN_PLAN' ? 'ตามแผน' : 'นอกแผน',
    สถานะการบันทึก: r.status === 'RECORDED' ? 'บันทึกแล้ว' : 'ไม่บันทึก',
    คณะตามสังกัดวิชา: r.faculty,
    สาขาวิชา: r.major,
    รหัสวิชา: r.courseCode,
    ชื่อวิชา: r.courseName,
    กลุ่มเรียน: r.section
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายละเอียดรายบุคคล');
  const safeName = selectedLecturer.replace(/[\\/:*?"<>|]/g, '');
  XLSX.writeFile(wb, `รายงานการบันทึกคะแนน_${safeName}.xlsx`);
  showToast(`ส่งออกรายงานของ ${selectedLecturer} เรียบร้อยแล้ว`);
}

// ==================== SAMPLE EXCEL TEMPLATE ====================
function downloadSampleExcel() {
  const wb = XLSX.utils.book_new();
  const summaryHeader = [
    ['สรุปจำนวนกลุ่มเรียนที่บันทึกคะแนน ระดับปริญญาตรี ภาค 1/2569 รอบที่ 2 ตามแผน'],
    ['ข้อมูล ณ วันที่ 9 พฤศจิกายน 2569'],
    ['ลำดับ', 'คณะ', 'การบันทึกคะแนนเก็บ รอบที่ 2 (ครั้งที่ 6-10)', '', '', '', '', ''],
    [
      '',
      '',
      'จำนวนรายวิชาที่ต้องบันทึกคะแนนเก็บ',
      'จำนวนกลุ่มที่ต้องบันทึกคะแนนเก็บ',
      'จำนวนกลุ่มที่บันทึกคะแนนเก็บแล้ว',
      'ร้อยละของจำนวนกลุ่มที่บันทึกคะแนนเก็บ',
      'จำนวนกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ',
      'ร้อยละกลุ่มที่ไม่ได้บันทึกคะแนนเก็บ'
    ],
    [1, 'คณะตัวอย่าง', 10, 20, 18, 0.9, 2, 0.1],
    ['รวม', '', 10, 20, 18, 0.9, 2, 0.1]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryHeader), 'สรุปการบันทึก (ตามแผน)');

  const detailHeader = [
    ['รายงานการบันทึกคะแนน(รายกลุ่ม)'],
    ['ระดับการศึกษา:ปริญญาตรี ปีการศึกษา:2569 ภาคการศึกษา:1'],
    ['คณะตามสังกัดวิชา'],
    [
      'คณะตามสังกัดวิชา',
      'สาขาวิชา',
      'รหัสวิชา',
      'ชื่อวิชา',
      'กลุ่มเรียน',
      'ประเภทกลุ่มเรียน',
      'ลักษณะวิชา',
      'ลักษณะการเรียน',
      'ผู้สอน',
      'จำนวนครั้งที่เก็บคะแนน'
    ],
    ['คณะตัวอย่าง', 'สาขาวิชาตัวอย่าง', 'ABC101', 'รายวิชาตัวอย่าง', '01', 'ปกติ', 'บังคับ', 'บรรยาย', 'อาจารย์ตัวอย่าง', 0]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailHeader), 'ไม่บันทึก(ตามแผน)');

  XLSX.writeFile(wb, 'Template_รายงานการบันทึกคะแนนเก็บ.xlsx');
  showToast('ดาวน์โหลดไฟล์เทมเพลต Excel เรียบร้อยแล้ว');
}

// ==================== UTILITY HELPERS ====================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortenFacultyName(name) {
  return String(name || '').replace(/^คณะ/, 'ค.').replace(/^วิทยาลัย/, 'ว.').trim();
}

function sortRecords(arr, sortObj) {
  const { key, dir } = sortObj;
  return [...arr].sort((a, b) => {
    const valA = String(a[key] ?? '');
    const valB = String(b[key] ?? '');
    return dir === 'asc'
      ? valA.localeCompare(valB, 'th', { numeric: true })
      : valB.localeCompare(valA, 'th', { numeric: true });
  });
}
