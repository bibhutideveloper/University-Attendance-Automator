/**
 * University Attendance Automator - Content Script
 * 
 * Safely marks students Present or Absent based on 3-digit roll number suffixes.
 * NEVER automatically submits or clicks "Mark Attendance".
 * NEVER selects Holiday or WEEKLY OFF.
 */

// =============================================================================
// SELECTOR & CONFIGURATION SECTION
// Modify these selectors if university portal DOM deviates from standard layout.
// =============================================================================
const ATTENDANCE_CONFIG = {
  SELECTORS: {
    // Attendance table selector (null = auto-detect via header indicators)
    table: null,
    
    // Row selector within table (null = standard tbody tr or table tr excluding th)
    studentRow: null,
    
    // Explicit roll number cell or text element within row (null = auto-detected from column)
    rollNumber: null,
    
    // Explicit Present radio selector within row (null = auto-detected from column/label/order)
    presentRadio: null,
    
    // Explicit Absent radio selector within row (null = auto-detected from column/label/order)
    absentRadio: null
  },

  // Header keywords used to detect columns dynamically (case-insensitive)
  HEADER_PATTERNS: {
    admissionNo: [/admission\s*no/i, /adm\s*no/i, /admission/i],
    subCourse: [/sub[\s-]*course/i, /course/i],
    subSection: [/sub[\s-]*section/i, /section/i],
    studentName: [/student\s*name/i, /student/i, /^name$/i],
    rollNo: [/roll\s*no/i, /roll\s*number/i, /rollno/i, /university\s*roll/i],
    present: [/present/i, /^p$/i],
    absent: [/absent/i, /^a$/i],
    holiday: [/holiday/i, /^h$/i],
    weeklyOff: [/weekly\s*off/i, /weeklyoff/i, /w\.?\s*o\.?/i, /^off$/i]
  },

  // Key indicators required to confirm a table is an Attendance table
  REQUIRED_PAGE_INDICATORS: [
    /roll\s*no/i,
    /present/i,
    /absent/i
  ],

  // Fallback positional radio button order per row (0-indexed)
  // When column index or labels are not explicitly associated:
  // 0 -> Present, 1 -> Absent, 2 -> Holiday, 3 -> WEEKLY OFF
  FALLBACK_RADIO_ORDER: {
    PRESENT: 0,
    ABSENT: 1,
    HOLIDAY: 2,
    WEEKLY_OFF: 3
  }
};

// =============================================================================
// DOM INSPECTION & TABLE DETECTION UTILITIES
// =============================================================================

/**
 * Locate the university attendance table on the active webpage.
 * Inspects all tables and analyzes their headers.
 */
function findAttendanceTable() {
  // If user defined explicit table selector in ATTENDANCE_CONFIG:
  if (ATTENDANCE_CONFIG.SELECTORS.table) {
    const customTable = document.querySelector(ATTENDANCE_CONFIG.SELECTORS.table);
    if (customTable) return { table: customTable, detectedVia: 'customSelector' };
  }

  // Scan all tables on the page
  const tables = Array.from(document.querySelectorAll('table'));
  for (const table of tables) {
    const text = table.textContent || '';
    const matchesAllIndicators = ATTENDANCE_CONFIG.REQUIRED_PAGE_INDICATORS.every(pattern => pattern.test(text));
    if (matchesAllIndicators) {
      return { table, detectedVia: 'indicators' };
    }
  }

  return null;
}

/**
 * Detect column indices by inspecting table header cells (th or thead tr td).
 */
function detectColumnIndices(table) {
  const columnMap = {
    admissionNo: -1,
    subCourse: -1,
    subSection: -1,
    studentName: -1,
    rollNo: -1,
    present: -1,
    absent: -1,
    holiday: -1,
    weeklyOff: -1
  };

  if (!table) return columnMap;

  // Look for header row in thead or first tr containing th / td
  let headerCells = Array.from(table.querySelectorAll('thead th, thead td'));
  if (headerCells.length === 0) {
    const firstRow = table.querySelector('tr');
    if (firstRow) {
      headerCells = Array.from(firstRow.children);
    }
  }

  headerCells.forEach((cell, index) => {
    const cellText = (cell.textContent || '').trim();
    for (const [key, patterns] of Object.entries(ATTENDANCE_CONFIG.HEADER_PATTERNS)) {
      if (patterns.some(p => p.test(cellText))) {
        if (columnMap[key] === -1) {
          columnMap[key] = index;
        }
      }
    }
  });

  return columnMap;
}

/**
 * Retrieve normal student rows from the attendance table.
 * Excludes header rows, summary/filter rows, and footers.
 */
function getStudentRows(table) {
  if (!table) return [];

  if (ATTENDANCE_CONFIG.SELECTORS.studentRow) {
    return Array.from(table.querySelectorAll(ATTENDANCE_CONFIG.SELECTORS.studentRow));
  }

  // Check tbody first if available
  const tbodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const candidateRows = tbodyRows.length > 0 ? tbodyRows : Array.from(table.querySelectorAll('tr'));

  return candidateRows.filter(row => {
    // Ignore header rows
    if (row.querySelector('th') && !row.querySelector('td')) return false;
    if (row.closest('thead') || row.closest('tfoot')) return false;

    // Row must contain at least some td elements
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return false;

    // Row should contain radio buttons or inputs
    const radios = row.querySelectorAll('input[type="radio"]');
    return radios.length > 0;
  });
}

/**
 * Extract roll number from a student row.
 * Returns { rawText, suffixNumber } or null.
 */
function extractStudentRollNumber(row, columnMap) {
  let rollText = '';

  // Priority 1: Configured selector
  if (ATTENDANCE_CONFIG.SELECTORS.rollNumber) {
    const el = row.querySelector(ATTENDANCE_CONFIG.SELECTORS.rollNumber);
    if (el) rollText = el.textContent || '';
  }

  // Priority 2: Detected rollNo column index
  if (!rollText && columnMap && columnMap.rollNo !== -1) {
    const cells = row.querySelectorAll('td');
    if (cells[columnMap.rollNo]) {
      rollText = cells[columnMap.rollNo].textContent || '';
    }
  }

  // Priority 3: Fallback scan across row cells for roll-number like string
  if (!rollText) {
    const cells = Array.from(row.querySelectorAll('td'));
    for (const cell of cells) {
      const txt = (cell.textContent || '').trim();
      // Match patterns like SU25BCAGAI018 or alphanumeric ending in digits
      if (/[A-Za-z0-9]*\d{3,}$/i.test(txt)) {
        rollText = txt;
        break;
      }
    }
  }

  rollText = rollText.trim();
  if (!rollText) return null;

  // Extract suffix number:
  // Take the last 3 characters or trailing digits
  let suffixNumber = null;
  const last3 = rollText.slice(-3);
  if (/^\d{1,3}$/.test(last3)) {
    suffixNumber = parseInt(last3, 10);
  } else {
    const digitMatch = rollText.match(/(\d{1,3})$/);
    if (digitMatch) {
      suffixNumber = parseInt(digitMatch[1], 10);
    }
  }

  if (suffixNumber === null || isNaN(suffixNumber)) {
    return null;
  }

  return {
    raw: rollText,
    suffix: suffixNumber
  };
}

/**
 * Locate Present and Absent radio buttons in a student row.
 * Uses a robust 3-tier strategy:
 * Tier 1: Column index matching
 * Tier 2: Label / Value / Attribute semantic matching
 * Tier 3: Verified positional order fallback
 */
function findRowRadios(row, columnMap) {
  let presentRadio = null;
  let absentRadio = null;

  // If user provided explicit selectors
  if (ATTENDANCE_CONFIG.SELECTORS.presentRadio) {
    presentRadio = row.querySelector(ATTENDANCE_CONFIG.SELECTORS.presentRadio);
  }
  if (ATTENDANCE_CONFIG.SELECTORS.absentRadio) {
    absentRadio = row.querySelector(ATTENDANCE_CONFIG.SELECTORS.absentRadio);
  }
  if (presentRadio && absentRadio) {
    return { presentRadio, absentRadio, method: 'customSelector' };
  }

  const cells = Array.from(row.querySelectorAll('td'));
  const allRadios = Array.from(row.querySelectorAll('input[type="radio"]'));

  if (allRadios.length === 0) {
    return null;
  }

  // Tier 1: Column Index Matching
  if (columnMap && columnMap.present !== -1 && columnMap.absent !== -1) {
    const pCell = cells[columnMap.present];
    const aCell = cells[columnMap.absent];
    if (pCell && aCell) {
      const pRadio = pCell.querySelector('input[type="radio"]');
      const aRadio = aCell.querySelector('input[type="radio"]');
      if (pRadio && aRadio) {
        return { presentRadio: pRadio, absentRadio: aRadio, method: 'columnIndex' };
      }
    }
  }

  // Tier 2: Semantic Matching (value, label, aria, or title)
  for (const radio of allRadios) {
    const val = (radio.value || '').toLowerCase().trim();
    const title = (radio.title || '').toLowerCase().trim();
    const aria = (radio.getAttribute('aria-label') || '').toLowerCase().trim();

    // Associated label text (via label[for] or parent label)
    let labelText = '';
    if (radio.id) {
      const lbl = row.querySelector(`label[for="${CSS.escape(radio.id)}"]`) || document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
      if (lbl) labelText = lbl.textContent.toLowerCase().trim();
    }
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      labelText += ' ' + parentLabel.textContent.toLowerCase().trim();
    }
    const siblingText = radio.nextSibling?.textContent?.toLowerCase().trim() || '';

    const descriptor = `${val} ${title} ${aria} ${labelText} ${siblingText}`;

    if (!presentRadio && (descriptor.includes('present') || val === 'p')) {
      presentRadio = radio;
    } else if (!absentRadio && (descriptor.includes('absent') || val === 'a')) {
      absentRadio = radio;
    }
  }

  if (presentRadio && absentRadio) {
    return { presentRadio, absentRadio, method: 'semanticMatching' };
  }

  // Tier 3: Positional Fallback
  // Verified standard order: 0: Present, 1: Absent, 2: Holiday, 3: WEEKLY OFF
  if (allRadios.length >= 2) {
    presentRadio = allRadios[ATTENDANCE_CONFIG.FALLBACK_RADIO_ORDER.PRESENT];
    absentRadio = allRadios[ATTENDANCE_CONFIG.FALLBACK_RADIO_ORDER.ABSENT];
    return { presentRadio, absentRadio, method: 'positionalOrder' };
  }

  return null;
}

/**
 * Safely select a radio button without clicking submit.
 * Dispatches click, change, and input events to trigger web framework reactivity.
 */
function selectRadio(radio) {
  if (!radio) return false;
  
  if (!radio.checked) {
    radio.checked = true;
  }

  // Dispatch events so React/Angular/Vue/jQuery change listeners fire
  radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  radio.dispatchEvent(new Event('change', { bubbles: true }));
  radio.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// =============================================================================
// CORE ATTENDANCE AUTOMATION LOGIC
// =============================================================================

/**
 * Inspect page and return detection status.
 */
function inspectPageStatus() {
  const tableResult = findAttendanceTable();
  if (!tableResult) {
    return {
      tableDetected: false,
      studentCount: 0,
      message: 'Attendance table not detected on this page.'
    };
  }

  const { table, detectedVia } = tableResult;
  const columnMap = detectColumnIndices(table);
  const rows = getStudentRows(table);

  return {
    tableDetected: true,
    studentCount: rows.length,
    detectedVia,
    columnMap,
    message: `Attendance table detected with ${rows.length} student rows.`
  };
}

/**
 * Apply Present / Absent attendance to visible rows on the attendance page.
 * @param {number[]} presentSuffixList Array of normalized integer suffixes to mark Present
 */
function applyAttendance(presentSuffixList) {
  const tableResult = findAttendanceTable();
  if (!tableResult) {
    return {
      success: false,
      tableDetected: false,
      error: 'Attendance table not detected on this page. No changes made.'
    };
  }

  const { table } = tableResult;
  const columnMap = detectColumnIndices(table);
  const rows = getStudentRows(table);

  if (rows.length === 0) {
    return {
      success: false,
      tableDetected: true,
      error: 'Attendance table was found, but no active student rows could be identified.'
    };
  }

  const presentSet = new Set(presentSuffixList);

  let presentCount = 0;
  let absentCount = 0;
  let skippedCount = 0;
  const details = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rollInfo = extractStudentRollNumber(row, columnMap);

    if (!rollInfo) {
      skippedCount++;
      details.push({ rowIndex: i + 1, status: 'SKIPPED', reason: 'Roll No not found or unparseable' });
      continue;
    }

    const radios = findRowRadios(row, columnMap);
    if (!radios || !radios.presentRadio || !radios.absentRadio) {
      skippedCount++;
      details.push({
        rowIndex: i + 1,
        roll: rollInfo.raw,
        status: 'SKIPPED',
        reason: 'Present/Absent radio buttons not found'
      });
      continue;
    }

    // Safety checks: Ensure selected radio is never Holiday or Weekly Off
    const isPresent = presentSet.has(rollInfo.suffix);
    const targetRadio = isPresent ? radios.presentRadio : radios.absentRadio;

    // Safety assertion: radio value or text must not indicate Holiday or Weekly Off
    const val = (targetRadio.value || '').toLowerCase();
    if (val.includes('holiday') || val.includes('off')) {
      skippedCount++;
      details.push({
        rowIndex: i + 1,
        roll: rollInfo.raw,
        status: 'SKIPPED',
        reason: 'Safety check: Target radio indicated Holiday or Weekly Off'
      });
      continue;
    }

    selectRadio(targetRadio);

    if (isPresent) {
      presentCount++;
      details.push({ rowIndex: i + 1, roll: rollInfo.raw, suffix: rollInfo.suffix, status: 'PRESENT' });
    } else {
      absentCount++;
      details.push({ rowIndex: i + 1, roll: rollInfo.raw, suffix: rollInfo.suffix, status: 'ABSENT' });
    }
  }

  return {
    success: true,
    tableDetected: true,
    totalRows: rows.length,
    presentCount,
    absentCount,
    skippedCount,
    message: `Processed current table page: ${rows.length} students`
  };
}

/**
 * Extract roll numbers of students currently marked Present on the page.
 * Returns array of roll suffixes (e.g. [3, 18, 103]) and count.
 */
function extractPresentRollNumbers() {
  const tableResult = findAttendanceTable();
  if (!tableResult) {
    return {
      success: false,
      tableDetected: false,
      error: 'Attendance table not detected on this page.'
    };
  }

  const { table } = tableResult;
  const columnMap = detectColumnIndices(table);
  const rows = getStudentRows(table);

  if (rows.length === 0) {
    return {
      success: false,
      tableDetected: true,
      error: 'Attendance table was found, but no active student rows could be identified.'
    };
  }

  const presentSuffixes = [];
  const details = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rollInfo = extractStudentRollNumber(row, columnMap);
    if (!rollInfo) continue;

    const radios = findRowRadios(row, columnMap);
    if (!radios || !radios.presentRadio) continue;

    // Check if the Present radio is currently checked
    if (radios.presentRadio.checked) {
      presentSuffixes.push(rollInfo.suffix);
      details.push({
        rowIndex: i + 1,
        roll: rollInfo.raw,
        suffix: rollInfo.suffix
      });
    }
  }

  // Sort numerically for neat presentation
  presentSuffixes.sort((a, b) => a - b);

  return {
    success: true,
    tableDetected: true,
    totalRows: rows.length,
    presentRolls: presentSuffixes,
    count: presentSuffixes.length,
    details
  };
}

// =============================================================================
// RUNTIME MESSAGE LISTENER
// =============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'DETECT_TABLE') {
    const status = inspectPageStatus();
    sendResponse(status);
    return true;
  }

  if (request.action === 'APPLY_ATTENDANCE') {
    const result = applyAttendance(request.presentNumbers || []);
    sendResponse(result);
    return true;
  }

  if (request.action === 'GET_PRESENT_ROLLS') {
    const result = extractPresentRollNumbers();
    sendResponse(result);
    return true;
  }

  if (request.action === 'PING') {
    sendResponse({ pong: true });
    return true;
  }
});

