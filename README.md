# University Attendance Automator Chrome Extension

A lightweight, secure Chrome Extension (Manifest V3) designed specifically for university attendance portals. It allows teachers and faculty to mark students **Present** or **Absent** quickly by entering only the last 3 digits of student roll numbers.

---

## 🚀 Key Features & Safety Rules

- **3-Digit Suffix Matching**: Handles any standard format (`SU25BCAGAI018` &rarr; `18`, `SU25BCAGAI003` &rarr; `3`, `SU25BCAGAI103` &rarr; `103`). Leading zeroes are ignored (`003` = `03` = `3`).
- **📥 Get Present from Page**: One-click extraction of roll numbers of students already marked Present on the webpage directly into the popup input box!
- **Flexible Input**: Accepts comma-separated (`18,3,103`), space-separated (`18 3 103`), newlines, or mixed formats.
- **Input Validation**: Automatically de-duplicates values (`5, 005, 18` &rarr; `5, 18`) and strictly rejects invalid entries (`1000`, `abc`, `12a`, `-5`).
- **3-Tier Radio Detection**: Identifies Present and Absent radio buttons via column header mapping, label/attribute matching, or positional fallback.
- **Strict Safety Guarantee**:
  - **NEVER** clicks "Mark Attendance", "Submit", or "Save".
  - **NEVER** selects **Holiday** or **WEEKLY OFF**.
  - Operates only on normal student rows, safely skipping invalid or summary rows.
- **Zero Heavy Dependencies**: Built with pure Manifest V3, HTML, CSS, and Vanilla JavaScript.

---

## 📂 Project Structure

```text
University Attendance Automator/
│
├── manifest.json              # Manifest V3 configuration (activeTab & scripting)
├── popup.html                 # Extension popup markup
├── popup.css                  # Modern UI styles
├── popup.js                   # Input validation, parser, and UI event handling
├── content.js                 # DOM inspection, table detection, radio selection
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test-attendance-page.html  # Mock portal page for testing and verification
├── test-runner.js             # Automated test suite for parser and matching
└── README.md                  # Complete documentation and user guide
```

---

## 🔍 How Roll-Number Matching Works

1. **User Input Normalization**:
   - The user inputs raw roll suffixes (e.g. `18, 3, 103` or `18 3 103`).
   - The extension tokenizes by commas, spaces, tabs, and newlines.
   - Each token is verified to be digits only within `0` to `999`.
   - Converted to integer (`parseInt(token, 10)`), stripping leading zeroes (`"003"` &rarr; `3`, `"018"` &rarr; `18`).
   - Stored in a deduplicated `Set` for instant $O(1)$ lookups.

2. **Student Row Matching**:
   - For every student row, the roll number text is extracted (e.g. `SU25BCAGAI018`).
   - The last 3 characters/digits are parsed as an integer:
     - `SU25BCAGAI018` &rarr; `018` &rarr; `18`
     - `SU25BCAGAI003` &rarr; `003` &rarr; `3`
     - `SU25BCAGAI103` &rarr; `103` &rarr; `103`
     - `SU25BCAGAI025` &rarr; `025` &rarr; `25`
   - Comparison:
     - If the suffix **is** in the entered list &rarr; **Present** radio is selected.
     - If the suffix **is not** in the entered list &rarr; **Absent** radio is selected.

---

## 🎯 How Present/Absent Radios are Detected

The extension uses an isolated configuration object at the top of [`content.js`](file:///d:/Bibhuti/Project/University%20Attendance%20Automator/content.js#L11-L45) (`ATTENDANCE_CONFIG`) with a 3-tier detection strategy:

1. **Tier 1 (Column Header Detection)**:
   - Scans table headers (`th` / `td`) for `Roll No`, `Present`, `Absent`, `Holiday`, `WEEKLY OFF`.
   - Locates the radio button inside the student's corresponding column cell (`cells[presentCol]`, `cells[absentCol]`).
2. **Tier 2 (Semantic Label & Attribute Matching)**:
   - Evaluates each radio button's `value`, `aria-label`, `title`, and associated `<label for="...">` or wrapping `<label>`.
   - Matches text containing "Present" / "Absent" (or values `"P"` / `"A"`).
3. **Tier 3 (Positional Fallback)**:
   - If headers/labels lack explicit IDs, falls back to the verified portal ordering:
     - **0**: Present
     - **1**: Absent
     - **2**: Holiday *(NEVER selected)*
     - **3**: WEEKLY OFF *(NEVER selected)*
4. **Framework Reactivity**:
   - Dispatches `click`, `change`, and `input` events on the radio input so frontend frameworks (Angular, React, Vue, jQuery) automatically detect state changes.

---

## 🛠️ How to Load the Extension in Chrome

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner, turn **ON** **Developer mode**.
4. Click the **Load unpacked** button in the top-left corner.
5. In the folder picker dialog, select the project directory:
   ```text
   D:\Bibhuti\Project\University Attendance Automator
   ```
6. The **University Attendance Automator** icon will appear in your Chrome toolbar and extensions menu. (Pin it for easy access).

---

## 🧪 How to Test It Safely

### Step 1: Open the Included Test Page
1. In Chrome, press `Ctrl + O` (or drag and drop) and open:
   ```text
   file:///d:/Bibhuti/Project/University Attendance Automator/test-attendance-page.html
   ```
   *(Or double-click `test-attendance-page.html` in Windows Explorer)*.
2. This page contains the exact table structure with 8 sample students:
   - `SU25BCAGAI001`
   - `SU25BCAGAI002`
   - `SU25BCAGAI003`
   - `SU25BCAGAI005`
   - `SU25BCAGAI018`
   - `SU25BCAGAI025`
   - `SU25BCAGAI041`
   - `SU25BCAGAI103`

### Step 2: Open the Extension Popup
1. Click the extension icon in the Chrome toolbar.
2. The badge will show **Table Detected** (8 students found).

### Step 3: Enter Present Roll Suffixes (or Extract them from Page)
- **Option A (Manual Input)**: In the input box, enter:
  ```text
  18, 3, 103
  ```
  *(Accepts space-separated `18 3 103`, newlines, or zero-padded `018, 003, 103`)*.
- **Option B (📥 Get from Page)**: Click the **📥 Get from Page** button. The extension will inspect rows where "Present" is already selected and automatically populate their roll suffixes (e.g., `3, 18`) into the input box!

### Step 4: Click "Apply Attendance"
- The extension will mark:
  - `SU25BCAGAI018` &rarr; **Present**
  - `SU25BCAGAI003` &rarr; **Present**
  - `SU25BCAGAI103` &rarr; **Present**
  - All other 5 students &rarr; **Absent**
- Summary report:
  - **Students found**: 8
  - **Present**: 3
  - **Absent**: 5
  - **Skipped**: 0

### Step 5: Verify Safety
- Notice that neither **Holiday** nor **WEEKLY OFF** was selected.
- Notice that the **Mark Attendance** button was **NOT clicked**. You retain full control to visually review the selections and click submit manually.

---

## ⚙️ Customizing Selectors for Your Portal

If your specific portal has custom class names or unique DOM layout, all selectors are isolated at the top of [`content.js`](file:///d:/Bibhuti/Project/University%20Attendance%20Automator/content.js#L11-L45):

```javascript
const ATTENDANCE_CONFIG = {
  SELECTORS: {
    table: null,         // e.g. "#attendanceGrid"
    studentRow: null,    // e.g. "tbody tr.student-item"
    rollNumber: null,    // e.g. ".roll-col"
    presentRadio: null,  // e.g. "input.radio-present"
    absentRadio: null    // e.g. "input.radio-absent"
  },
  ...
};
```
By leaving them as `null`, the auto-detection engine handles standard tables automatically.

---

# 🌐 Phase 2: Real-Time Attendance Sharing (Supabase)

Phase 2 adds live attendance sharing between teachers and faculty via custom room codes, powered directly by Supabase REST and Supabase Realtime without any custom Node.js server.

The core attendance automation logic remains **100% intact and untouched**.

---

## 🏗️ Architecture & Data Privacy

```text
[Host Profile A]                      [Supabase Backend]                    [Receiver Profile B]
 (Teacher / Sender)                    (Database + Realtime)                 (Colleague / Receiver)
        │                                      │                                       │
        │── 1. Create Room (BCA_2A_DBMS) ─────>│                                       │
        │      (Expires in 15m)                │<────── 2. Join Room (BCA_2A_DBMS) ────│
        │                                      │        (Subscribes to Realtime WSS)   │
        │── 3. Click "Share Present" ─────────>│                                       │
        │      (Reads DOM: [4, 8, 15, 27])     │                                       │
        │      (Replaces room attendance)      │─────── 4. Realtime Broadcast ────────>│
        │                                      │        (Auto-updates UI: 4 Present)   │
        │                                      │                                       │
        │                                      │        5. Click "Import to Attendance"│
        │                                      │           (Populates input: 4, 8...)  │
        │                                      │           (Teacher clicks Apply)      │
```

### 🔒 Privacy Guarantees
- **Only** normalized 3-digit roll number suffixes are stored (e.g. `[4, 8, 15, 27]`).
- **NO** student names, admission numbers, credentials, or university portal data are ever transmitted or saved.
- **NO** `service_role` key is ever bundled in the extension. Only the standard `anon` public key is used.

---

## ⚡ Supabase Setup Guide

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the Supabase Dashboard, open the **SQL Editor**.
3. Open [`supabase/schema.sql`](file:///d:/Bibhuti/Project/University%20Attendance%20Automator/supabase/schema.sql) from this project, paste its contents into the SQL Editor, and click **Run**.

### 2. What `supabase/schema.sql` Configures:
* **Table `attendance_rooms`**:
  * `id` (UUID, Primary Key)
  * `room_code` (TEXT, Unique, indexed)
  * `attendance_data` (JSONB, stores `{"present": [...]}`)
  * `created_at` / `updated_at` (Timestamps)
  * `expires_at` (TIMESTAMPTZ, authoritative server expiry)
  * `is_active` (BOOLEAN, active flag)
* **Realtime Publication**:
  * Adds `attendance_rooms` to `supabase_realtime` with `REPLICA IDENTITY FULL` so updates are instantly broadcasted via WebSockets.
* **Row-Level Security (RLS)**:
  * Public read (`SELECT`) for all active and historical rooms.
  * Public insert (`INSERT`) restricted to valid room codes (`^[A-Z0-9_-]{3,30}$`) and future expiry.
  * Public update (`UPDATE`) for sharing attendance and closing rooms.

### 3. Configure Credentials in the Extension
You can configure credentials in either of two ways:

#### Method A: Direct File Configuration
Open [`config.js`](file:///d:/Bibhuti/Project/University%20Attendance%20Automator/config.js) and enter your project credentials:
```javascript
const SUPABASE_CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

#### Method B: Popup Settings Modal
1. Click the extension icon.
2. Click the gear icon (**⚙️**) in the top-right header.
3. Paste your **Supabase URL** and **Anon Key**, then click **Save Settings**. (Stored securely in `chrome.storage.local`).

---

## 🧪 Step-by-Step Two-Profile Realtime Testing Guide

To verify real-time synchronization between two users, open two separate Chrome profiles (or one normal profile and one Incognito/guest window with extension enabled):

### Preparation
1. Open [`test-attendance-page.html`](file:///d:/Bibhuti/Project/University%20Attendance%20Automator/test-attendance-page.html) in both **Profile A** and **Profile B**.

### Profile A (Host / Sender)
1. Open the extension popup & click the **📤 Share Room** tab.
2. Enter Room Code:
   ```text
   BCA_2A_DBMS
   ```
3. Set Expiry: `15 minutes` & click **Create / Update Room**.
4. The card shows `🟢 Room Active` with a live ticking countdown (`14:59`, `14:58`...).
5. On the test webpage, click **Set Present: [4, 8, 15, 27]** (or manually check Present on some rows).
6. In the extension popup, click **📤 Share Present**.
7. Host card updates: `Present Students: 4` (`[4, 8, 15, 27]`).

### Profile B (Receiver / Listener)
1. Open the extension popup & click the **📥 Receive Room** tab.
2. Enter Room Code:
   ```text
   BCA_2A_DBMS
   ```
3. Click **Join Room**.
4. The receiver immediately connects to Supabase Realtime (`⚡ Realtime Live Syncing`), shows the countdown matching the server expiry, and displays:
   * **Present Students**: `4`
   * **Shared Rolls**: `4, 8, 15, 27`

### Test Live Realtime Update
1. On **Profile A**'s webpage, click **Set Present: [4, 8, 15, 27, 34]**.
2. On **Profile A**'s popup, click **📤 Share Present**.
3. **Watch Profile B's screen**: Without clicking refresh, Profile B automatically updates in real-time via WebSocket:
   * **Present Students**: `5`
   * **Shared Rolls**: `4, 8, 15, 27, 34`
4. On **Profile B**, click **📥 Import to Attendance**.
5. Profile B automatically switches to the **📝 Attendance** tab with `4, 8, 15, 27, 34` populated in the input field!
6. Profile B clicks **Apply Attendance** to mark the attendance on their portal.

### Test Expiry & Room Closure
1. In Profile A, click **Close Room** and confirm.
2. Profile B's card immediately receives the update and marks status `CLOSED`.
3. Action buttons (**Share Present**, **Import to Attendance**) are safely disabled.
4. Server `expires_at` is strictly authoritative: if a room expires, attempts to share or import are blocked.

