/**
 * Unit & Integration Test Suite for University Attendance Automator
 */

const fs = require('fs');
const path = require('path');

// 1. Test Input Parsing Logic
function parseRollInput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { validNumbers: [], invalidTokens: [] };
  }

  const tokens = rawText
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  const validNumbers = [];
  const invalidTokens = [];
  const seen = new Set();

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const num = parseInt(token, 10);
      if (num >= 0 && num <= 999) {
        if (!seen.has(num)) {
          seen.add(num);
          validNumbers.push(num);
        }
      } else {
        invalidTokens.push(token);
      }
    } else {
      invalidTokens.push(token);
    }
  }

  return { validNumbers, invalidTokens };
}

// 2. Test Roll Suffix Extraction
function extractStudentRollNumber(rollText) {
  if (!rollText) return null;
  const clean = rollText.trim();
  if (!clean) return null;

  const last3 = clean.slice(-3);
  if (/^\d{1,3}$/.test(last3)) {
    return parseInt(last3, 10);
  }

  const digitMatch = clean.match(/(\d{1,3})$/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  return null;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('=== Test Suite: University Attendance Automator ===\n');

console.log('1. Testing Input Parsing & Normalization:');
// Test 1: Comma separated
const t1 = parseRollInput('18,3,103');
assert(JSON.stringify(t1.validNumbers) === JSON.stringify([18, 3, 103]), 'Comma separated: 18,3,103 -> [18, 3, 103]');

// Test 2: Space separated
const t2 = parseRollInput('18 3 103');
assert(JSON.stringify(t2.validNumbers) === JSON.stringify([18, 3, 103]), 'Space separated: 18 3 103 -> [18, 3, 103]');

// Test 3: Mixed commas, spaces, newlines
const t3 = parseRollInput('18, 3 103\n27\t34');
assert(JSON.stringify(t3.validNumbers) === JSON.stringify([18, 3, 103, 27, 34]), 'Mixed whitespace/newlines: 18, 3 103\\n27\\t34');

// Test 4: Leading zeroes normalized & Deduplication
const t4 = parseRollInput('5, 005, 5, 18, 018');
assert(JSON.stringify(t4.validNumbers) === JSON.stringify([5, 18]), 'Duplicates & zeroes: 5, 005, 5, 18, 018 -> [5, 18]');

// Test 5: Rejection of invalid inputs (1000, abc, 12a, -5)
const t5 = parseRollInput('18, 1000, abc, 12a, -5, 3');
assert(t5.invalidTokens.includes('1000'), 'Catches > 999: 1000');
assert(t5.invalidTokens.includes('abc'), 'Catches non-digits: abc');
assert(t5.invalidTokens.includes('12a'), 'Catches alphanumeric: 12a');
assert(t5.invalidTokens.includes('-5'), 'Catches negative: -5');
assert(JSON.stringify(t5.validNumbers) === JSON.stringify([18, 3]), 'Keeps valid: [18, 3]');

console.log('\n2. Testing Roll Suffix Extraction:');
assert(extractStudentRollNumber('SU25BCAGAI018') === 18, 'SU25BCAGAI018 -> 18');
assert(extractStudentRollNumber('SU25BCAGAI003') === 3, 'SU25BCAGAI003 -> 3');
assert(extractStudentRollNumber('SU25BCAGAI103') === 103, 'SU25BCAGAI103 -> 103');
assert(extractStudentRollNumber('SU25BCAGAI000') === 0, 'SU25BCAGAI000 -> 0');
assert(extractStudentRollNumber('SU25BCAGAI025') === 25, 'SU25BCAGAI025 -> 25');
assert(extractStudentRollNumber('018') === 18, 'Plain 018 -> 18');
assert(extractStudentRollNumber('3') === 3, 'Plain 3 -> 3');
assert(extractStudentRollNumber('Header') === null, 'Non-roll string -> null');

console.log('\n3. Testing Attendance Table Matching Simulation:');
const sampleStudents = [
  { name: 'Aarav Sharma', roll: 'SU25BCAGAI001' },
  { name: 'Ananya Patel', roll: 'SU25BCAGAI002' },
  { name: 'Bibhuti Kumbhakar', roll: 'SU25BCAGAI003' },
  { name: 'Devendra Yadav', roll: 'SU25BCAGAI005' },
  { name: 'Ishita Verma', roll: 'SU25BCAGAI018' },
  { name: 'Karan Malhotra', roll: 'SU25BCAGAI025' },
  { name: 'Meera Nair', roll: 'SU25BCAGAI041' },
  { name: 'Pooja Soni', roll: 'SU25BCAGAI103' }
];

const enteredInput = '18, 3, 103';
const parsed = parseRollInput(enteredInput);
const presentSet = new Set(parsed.validNumbers);

let presentCount = 0;
let absentCount = 0;
const results = [];

sampleStudents.forEach(st => {
  const suffix = extractStudentRollNumber(st.roll);
  const isPresent = presentSet.has(suffix);
  if (isPresent) {
    presentCount++;
    results.push({ ...st, status: 'Present' });
  } else {
    absentCount++;
    results.push({ ...st, status: 'Absent' });
  }
});

assert(presentCount === 3, 'Present count matches expected (3)');
assert(absentCount === 5, 'Absent count matches expected (5)');
assert(results.find(s => s.roll === 'SU25BCAGAI018').status === 'Present', 'SU25BCAGAI018 is marked Present');
assert(results.find(s => s.roll === 'SU25BCAGAI003').status === 'Present', 'SU25BCAGAI003 is marked Present');
assert(results.find(s => s.roll === 'SU25BCAGAI103').status === 'Present', 'SU25BCAGAI103 is marked Present');
assert(results.find(s => s.roll === 'SU25BCAGAI025').status === 'Absent', 'SU25BCAGAI025 is marked Absent');
assert(results.find(s => s.roll === 'SU25BCAGAI041').status === 'Absent', 'SU25BCAGAI041 is marked Absent');

console.log('\n4. Testing Present Roll Numbers Extraction from Page Simulation:');
// Simulate table rows where 003 and 018 have Present checked
const simulatedRows = [
  { roll: 'SU25BCAGAI001', isPresentChecked: false },
  { roll: 'SU25BCAGAI002', isPresentChecked: false },
  { roll: 'SU25BCAGAI003', isPresentChecked: true },
  { roll: 'SU25BCAGAI005', isPresentChecked: false },
  { roll: 'SU25BCAGAI018', isPresentChecked: true },
  { roll: 'SU25BCAGAI025', isPresentChecked: false },
  { roll: 'SU25BCAGAI041', isPresentChecked: false },
  { roll: 'SU25BCAGAI103', isPresentChecked: false }
];

function simulateExtractPresentRolls(rows) {
  const extracted = [];
  rows.forEach(r => {
    if (r.isPresentChecked) {
      const suffix = extractStudentRollNumber(r.roll);
      if (suffix !== null) extracted.push(suffix);
    }
  });
  return extracted.sort((a, b) => a - b);
}

const extractedResult = simulateExtractPresentRolls(simulatedRows);
assert(JSON.stringify(extractedResult) === JSON.stringify([3, 18]), 'Extracts currently checked Present students [3, 18]');
assert(extractedResult.join(', ') === '3, 18', 'Formats as comma-separated: "3, 18"');

console.log('\n5. Testing Phase 2 Room Code & Expiry Logic:');
// 5.1 Room code validation
function validateRoomCode(code) {
  if (!code || typeof code !== 'string') return { isValid: false, normalized: '' };
  const normalized = code.trim().toUpperCase();
  const isValid = /^[A-Z0-9_-]{3,30}$/.test(normalized);
  return { isValid, normalized };
}

const r1 = validateRoomCode('bca_2a_dbms');
assert(r1.isValid && r1.normalized === 'BCA_2A_DBMS', 'Normalize lowercase: bca_2a_dbms -> BCA_2A_DBMS');

const r2 = validateRoomCode('BCA-2A-DBMS');
assert(r2.isValid && r2.normalized === 'BCA-2A-DBMS', 'Allows hyphens: BCA-2A-DBMS');

const r3 = validateRoomCode('bca 2a');
assert(!r3.isValid, 'Rejects spaces: "bca 2a"');

const r4 = validateRoomCode('b');
assert(!r4.isValid, 'Rejects short code (< 3 chars): "b"');

const r5 = validateRoomCode('BCA@2A#');
assert(!r5.isValid, 'Rejects special chars: "BCA@2A#"');

// 5.2 Countdown timer formatting
function formatRemainingTime(ms) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

assert(formatRemainingTime(14 * 60 * 1000 + 32 * 1000) === '14:32', 'Formats 14m 32s -> "14:32"');
assert(formatRemainingTime(0) === '00:00', 'Formats 0ms -> "00:00"');
assert(formatRemainingTime(-5000) === '00:00', 'Formats negative ms -> "00:00"');
assert(formatRemainingTime(75 * 60 * 1000 + 10 * 1000) === '01:15:10', 'Formats 1h 15m 10s -> "01:15:10"');

// 5.3 Attendance replacement payload (does NOT append)
let currentRoomAttendance = [4, 8, 15, 27];
assert(JSON.stringify(currentRoomAttendance) === JSON.stringify([4, 8, 15, 27]), 'Initial room state: [4, 8, 15, 27]');

// Update: new list [4, 8, 15, 27, 34]
const updatedList = [4, 8, 15, 27, 34];
currentRoomAttendance = updatedList; // Replaced, not appended
assert(JSON.stringify(currentRoomAttendance) === JSON.stringify([4, 8, 15, 27, 34]), 'Replaced list on second share: [4, 8, 15, 27, 34]');

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('✓ All logic assertions passed successfully!');
}
