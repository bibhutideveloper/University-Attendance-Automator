/**
 * University Attendance Automator - Popup Controller (Phase 2)
 * Combines original DOM automation with Supabase Realtime Room Sharing.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ===========================================================================
  // DOM ELEMENTS
  // ===========================================================================

  // Global / Navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const globalNotice = document.getElementById('globalNotice');
  const connectionBadge = document.getElementById('connectionBadge');
  const settingsBtn = document.getElementById('settingsBtn');

  // Tab 1: Attendance
  const rollInput = document.getElementById('rollInput');
  const getPresentBtn = document.getElementById('getPresentBtn');
  const applyBtn = document.getElementById('applyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const errorAlert = document.getElementById('errorAlert');
  const statusTitle = document.getElementById('statusTitle');
  const pageNote = document.getElementById('pageNote');
  const statStudents = document.getElementById('statStudents');
  const statPresent = document.getElementById('statPresent');
  const statAbsent = document.getElementById('statAbsent');
  const statSkipped = document.getElementById('statSkipped');
  const resultMessage = document.getElementById('resultMessage');

  // Tab 2: Share Attendance (Host)
  const shareSetupCard = document.getElementById('shareSetupCard');
  const shareActiveCard = document.getElementById('shareActiveCard');
  const shareRoomCode = document.getElementById('shareRoomCode');
  const shareExpirySelect = document.getElementById('shareExpirySelect');
  const shareCustomExpiryGroup = document.getElementById('shareCustomExpiryGroup');
  const shareCustomMinutes = document.getElementById('shareCustomMinutes');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const shareConflictBox = document.getElementById('shareConflictBox');
  const shareConflictText = document.getElementById('shareConflictText');
  const confirmUpdateBtn = document.getElementById('confirmUpdateBtn');
  const cancelConflictBtn = document.getElementById('cancelConflictBtn');
  const shareErrorAlert = document.getElementById('shareErrorAlert');
  const shareLivePill = document.getElementById('shareLivePill');
  const shareLiveStatus = document.getElementById('shareLiveStatus');
  const shareDisplayCode = document.getElementById('shareDisplayCode');
  const shareCountdown = document.getElementById('shareCountdown');
  const sharePresentCount = document.getElementById('sharePresentCount');
  const shareLastUpdated = document.getElementById('shareLastUpdated');
  const shareActionFeedback = document.getElementById('shareActionFeedback');
  const shareActionError = document.getElementById('shareActionError');
  const sharePresentBtn = document.getElementById('sharePresentBtn');
  const closeRoomBtn = document.getElementById('closeRoomBtn');
  const leaveHostViewBtn = document.getElementById('leaveHostViewBtn');

  // Tab 3: Receive Attendance (Receiver)
  const receiveSetupCard = document.getElementById('receiveSetupCard');
  const receiveActiveCard = document.getElementById('receiveActiveCard');
  const receiveRoomCode = document.getElementById('receiveRoomCode');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const receiveErrorAlert = document.getElementById('receiveErrorAlert');
  const receiveLivePill = document.getElementById('receiveLivePill');
  const receiveLiveStatus = document.getElementById('receiveLiveStatus');
  const receiveDisplayCode = document.getElementById('receiveDisplayCode');
  const receiveCountdown = document.getElementById('receiveCountdown');
  const receiveSyncStatus = document.getElementById('receiveSyncStatus');
  const receivePresentCount = document.getElementById('receivePresentCount');
  const receiveLastUpdated = document.getElementById('receiveLastUpdated');
  const receivePreviewRolls = document.getElementById('receivePreviewRolls');
  const receiveActionFeedback = document.getElementById('receiveActionFeedback');
  const receiveActionError = document.getElementById('receiveActionError');
  const importAttendanceBtn = document.getElementById('importAttendanceBtn');
  const receiveRefreshBtn = document.getElementById('receiveRefreshBtn');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const cfgSupabaseUrl = document.getElementById('cfgSupabaseUrl');
  const cfgSupabaseKey = document.getElementById('cfgSupabaseKey');
  const cfgFeedback = document.getElementById('cfgFeedback');

  // ===========================================================================
  // STATE
  // ===========================================================================
  let activeTabId = null;
  let isTableDetected = false;

  // Host State
  let hostActiveRoom = null;
  let hostTimerInterval = null;

  // Receiver State
  let receiverActiveRoom = null;
  let receiverTimerInterval = null;
  let receiverChannel = null;
  let latestReceivedPresentList = [];

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  init();

  async function init() {
    setupTabNavigation();
    setupAttendanceListeners();
    setupShareListeners();
    setupReceiveListeners();
    setupSettingsListeners();
    setupExternalLinks();

    // Check page for original attendance table
    await checkActivePage();

    // Restore any active room state from session storage
    await restoreSavedRoomStates();
  }

  function setupExternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (url) {
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url });
          } else {
            window.open(url, '_blank');
          }
        }
      });
    });
  }

  // ===========================================================================
  // TAB NAVIGATION
  // ===========================================================================
  function setupTabNavigation() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        switchTab(targetId);
      });
    });
  }

  function switchTab(targetId) {
    tabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === targetId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === targetId));
  }

  // ===========================================================================
  // SECTION 1: ATTENDANCE AUTOMATION (PRESERVED ORIGINAL LOGIC)
  // ===========================================================================
  function setupAttendanceListeners() {
    applyBtn.addEventListener('click', handleApplyAttendance);
    clearBtn.addEventListener('click', handleClear);
    getPresentBtn.addEventListener('click', handleGetPresentRolls);

    rollInput.addEventListener('input', () => {
      hideError();
    });
  }

  /**
   * Parse and normalize roll number suffix inputs.
   * Handles commas, spaces, tabs, newlines, mixed formatting.
   * Strips leading zeroes: 003 -> 3, 018 -> 18.
   * Deduplicates: 5, 005, 5, 18, 018 -> [5, 18].
   * Rejects numbers outside 0-999 or non-digits (e.g. 1000, abc, 12a, -5).
   */
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

  async function checkActivePage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showNotDetected('No active tab found.');
        return;
      }

      activeTabId = tab.id;

      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
        showNotDetected('Cannot run on browser system pages.');
        return;
      }

      await ensureContentScriptInjected(activeTabId);

      chrome.tabs.sendMessage(activeTabId, { action: 'DETECT_TABLE' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          showNotDetected('Attendance table not detected on this page.');
          return;
        }

        if (response.tableDetected) {
          isTableDetected = true;
          connectionBadge.className = 'badge badge-detected';
          connectionBadge.textContent = 'Table Detected';
          statStudents.textContent = response.studentCount || '0';
          pageNote.textContent = `${response.studentCount || 0} students available`;
          applyBtn.disabled = false;
          if (getPresentBtn) getPresentBtn.disabled = false;
        } else {
          showNotDetected('Attendance table not detected on this page.');
        }
      });
    } catch (err) {
      showNotDetected('Attendance table not detected on this page.');
    }
  }

  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (err) {
      // Continuing gracefully
    }
  }

  function showNotDetected(message) {
    isTableDetected = false;
    connectionBadge.className = 'badge badge-not-detected';
    connectionBadge.textContent = 'Not Detected';
    statStudents.textContent = '-';
    statPresent.textContent = '-';
    statAbsent.textContent = '-';
    statSkipped.textContent = '-';
    showError(message);
    applyBtn.disabled = true;
    if (getPresentBtn) getPresentBtn.disabled = true;
  }

  async function handleApplyAttendance() {
    hideError();
    hideResult();

    if (!isTableDetected) {
      showError('Attendance table not detected on this page.');
      return;
    }

    const rawInput = rollInput.value.trim();
    if (!rawInput) {
      showError('Please enter at least one roll number suffix, or all students will be marked Absent.');
      return;
    }

    const { validNumbers, invalidTokens } = parseRollInput(rawInput);

    if (invalidTokens.length > 0) {
      showError(`Invalid roll numbers found: "${invalidTokens.join(', ')}". Only numbers from 0 to 999 are valid.`);
      return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = 'Applying...';

    chrome.tabs.sendMessage(
      activeTabId,
      {
        action: 'APPLY_ATTENDANCE',
        presentNumbers: validNumbers
      },
      (response) => {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Attendance';

        if (chrome.runtime.lastError || !response) {
          showError('Failed to communicate with attendance page. Please refresh the page and try again.');
          return;
        }

        if (!response.success) {
          showError(response.error || 'Failed to apply attendance.');
          return;
        }

        statusTitle.textContent = 'Attendance Applied';
        statStudents.textContent = response.totalRows;
        statPresent.textContent = response.presentCount;
        statAbsent.textContent = response.absentCount;
        statSkipped.textContent = response.skippedCount;

        pageNote.textContent = response.message || `Processed ${response.totalRows} students`;

        showResult(`Attendance marked: ${response.presentCount} Present, ${response.absentCount} Absent. (Review & click "Mark Attendance" manually)`);
      }
    );
  }

  async function handleGetPresentRolls() {
    hideError();
    hideResult();

    if (!isTableDetected) {
      showError('Attendance table not detected on this page.');
      return;
    }

    if (getPresentBtn) {
      getPresentBtn.disabled = true;
      getPresentBtn.textContent = 'Fetching...';
    }

    chrome.tabs.sendMessage(
      activeTabId,
      { action: 'GET_PRESENT_ROLLS' },
      (response) => {
        if (getPresentBtn) {
          getPresentBtn.disabled = false;
          getPresentBtn.textContent = '📥 Get from Page';
        }

        if (chrome.runtime.lastError || !response) {
          showError('Failed to communicate with attendance page. Please refresh the page and try again.');
          return;
        }

        if (!response.success) {
          showError(response.error || 'Failed to extract present roll numbers.');
          return;
        }

        const rolls = response.presentRolls || [];
        if (rolls.length === 0) {
          showError('No students are currently marked Present on this page.');
          return;
        }

        rollInput.value = rolls.join(', ');

        statStudents.textContent = response.totalRows;
        statPresent.textContent = rolls.length;
        statAbsent.textContent = response.totalRows - rolls.length;
        statSkipped.textContent = 0;

        statusTitle.textContent = 'Extracted Present:';
        showResult(`Loaded ${rolls.length} present students into input box: ${rolls.join(', ')}`);
      }
    );
  }

  function handleClear() {
    rollInput.value = '';
    hideError();
    hideResult();
    statusTitle.textContent = 'Status:';
    statPresent.textContent = '-';
    statAbsent.textContent = '-';
    statSkipped.textContent = '-';
    if (isTableDetected) {
      checkActivePage();
    }
  }

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.style.display = 'block';
  }

  function hideError() {
    errorAlert.textContent = '';
    errorAlert.style.display = 'none';
  }

  function showResult(msg) {
    resultMessage.textContent = msg;
    resultMessage.style.display = 'block';
  }

  function hideResult() {
    resultMessage.textContent = '';
    resultMessage.style.display = 'none';
  }

  // ===========================================================================
  // SECTION 2: SHARE ATTENDANCE (HOST)
  // ===========================================================================
  function setupShareListeners() {
    shareExpirySelect.addEventListener('change', () => {
      shareCustomExpiryGroup.style.display = (shareExpirySelect.value === 'custom') ? 'block' : 'none';
    });

    createRoomBtn.addEventListener('click', () => handleCreateOrUpdateRoom(false));
    confirmUpdateBtn.addEventListener('click', () => handleCreateOrUpdateRoom(true));
    cancelConflictBtn.addEventListener('click', () => {
      shareConflictBox.style.display = 'none';
    });

    sharePresentBtn.addEventListener('click', handleHostSharePresent);
    closeRoomBtn.addEventListener('click', handleHostCloseRoom);

    leaveHostViewBtn.addEventListener('click', () => {
      stopHostCountdown();
      hostActiveRoom = null;
      shareActiveCard.style.display = 'none';
      shareSetupCard.style.display = 'block';
      clearSavedHostState();
    });
  }

  function getSelectedDurationMinutes() {
    const val = shareExpirySelect.value;
    if (val === 'custom') {
      const mins = parseInt(shareCustomMinutes.value, 10);
      return (isNaN(mins) || mins <= 0) ? 15 : Math.min(mins, 720);
    }
    return parseInt(val, 10) || 15;
  }

  async function handleCreateOrUpdateRoom(allowUpdate) {
    hideShareAlerts();
    shareConflictBox.style.display = 'none';

    const rawCode = shareRoomCode.value.trim();
    const { isValid, normalized, error } = SupabaseService.validateRoomCode(rawCode);

    if (!isValid) {
      showShareError(error);
      return;
    }

    const duration = getSelectedDurationMinutes();

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = 'Processing...';

    const res = await window.supabaseService.createOrUpdateRoom(normalized, duration, { allowUpdate });

    createRoomBtn.disabled = false;
    createRoomBtn.textContent = 'Create / Update Room';

    if (!res.success) {
      if (res.roomAlreadyActive) {
        shareConflictText.textContent = `Room "${normalized}" is already active (expires in ${SupabaseService.formatRemainingTime(res.remainingMs)}).`;
        shareConflictBox.style.display = 'block';
        return;
      }
      showShareError(res.error || 'Failed to initialize room in Supabase.');
      return;
    }

    // Success -> Display Active Host Card
    activateHostView(res.room);
    saveHostState(res.room);
  }

  function activateHostView(room) {
    hostActiveRoom = room;
    shareSetupCard.style.display = 'none';
    shareActiveCard.style.display = 'block';
    shareDisplayCode.textContent = room.room_code;

    const presentArr = room.attendance_data?.present || [];
    sharePresentCount.textContent = presentArr.length;
    shareLastUpdated.textContent = room.updated_at ? new Date(room.updated_at).toLocaleTimeString() : 'Not shared yet';

    startHostCountdown(room.expires_at);
  }

  function startHostCountdown(expiresAtIso) {
    stopHostCountdown();

    const targetMs = new Date(expiresAtIso).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = targetMs - now;

      if (diff <= 0) {
        // Expired
        stopHostCountdown();
        shareCountdown.textContent = '00:00';
        shareCountdown.classList.add('urgent');
        shareLiveStatus.textContent = 'EXPIRED';
        shareLivePill.className = 'room-live-pill expired';
        sharePresentBtn.disabled = true;
        showShareActionError('This attendance room has expired. Click "Change Room Code" to create a new session.');
        return;
      }

      shareCountdown.textContent = SupabaseService.formatRemainingTime(diff);
      shareCountdown.classList.toggle('urgent', diff < 120000); // red if < 2 mins
      shareLiveStatus.textContent = 'Room Active';
      shareLivePill.className = 'room-live-pill';
      sharePresentBtn.disabled = false;
    };

    tick();
    hostTimerInterval = setInterval(tick, 1000);
  }

  function stopHostCountdown() {
    if (hostTimerInterval) {
      clearInterval(hostTimerInterval);
      hostTimerInterval = null;
    }
  }

  async function handleHostSharePresent() {
    hideShareAlerts();

    if (!hostActiveRoom) return;

    // Check expiration before triggering DOM read
    const now = Date.now();
    if (new Date(hostActiveRoom.expires_at).getTime() <= now) {
      showShareActionError('This attendance room has expired.');
      return;
    }

    if (!isTableDetected) {
      showShareActionError('Attendance table not detected on active tab. Open the university attendance page first.');
      return;
    }

    sharePresentBtn.disabled = true;
    sharePresentBtn.textContent = 'Reading & Sharing...';

    // 1. Read currently selected Present students from ORIGINAL portal DOM
    chrome.tabs.sendMessage(
      activeTabId,
      { action: 'GET_PRESENT_ROLLS' },
      async (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          sharePresentBtn.disabled = false;
          sharePresentBtn.textContent = '📤 Share Present';
          showShareActionError('Failed to extract present students from table. Refresh the page and try again.');
          return;
        }

        const presentList = response.presentRolls || [];

        // 2. Save normalized present roll suffixes to active Supabase room
        const shareRes = await window.supabaseService.sharePresentRolls(hostActiveRoom.room_code, presentList);

        sharePresentBtn.disabled = false;
        sharePresentBtn.textContent = '📤 Share Present';

        if (!shareRes.success) {
          if (shareRes.isExpired) {
            shareLiveStatus.textContent = 'EXPIRED';
            shareLivePill.className = 'room-live-pill expired';
            sharePresentBtn.disabled = true;
          }
          showShareActionError(shareRes.error || 'Failed to sync with Supabase.');
          return;
        }

        // Update Host Card
        hostActiveRoom = shareRes.room;
        sharePresentCount.textContent = shareRes.presentCount;
        shareLastUpdated.textContent = new Date().toLocaleTimeString();

        showShareActionFeedback(`✓ Successfully shared ${shareRes.presentCount} present students [${shareRes.presentList.join(', ')}] to room ${hostActiveRoom.room_code}.`);
      }
    );
  }

  async function handleHostCloseRoom() {
    hideShareAlerts();

    if (!hostActiveRoom) return;

    const confirmed = confirm(`Close room "${hostActiveRoom.room_code}"?\nThe room will become immediately unavailable to receivers.`);
    if (!confirmed) return;

    closeRoomBtn.disabled = true;
    closeRoomBtn.textContent = 'Closing...';

    const res = await window.supabaseService.closeRoom(hostActiveRoom.room_code);

    closeRoomBtn.disabled = false;
    closeRoomBtn.textContent = 'Close Room';

    if (!res.success) {
      showShareActionError(res.error || 'Failed to close room.');
      return;
    }

    stopHostCountdown();
    shareLiveStatus.textContent = 'CLOSED';
    shareLivePill.className = 'room-live-pill closed';
    sharePresentBtn.disabled = true;
    closeRoomBtn.disabled = true;

    showShareActionFeedback(`Room "${hostActiveRoom.room_code}" closed successfully.`);
    clearSavedHostState();
  }

  function showShareError(msg) {
    shareErrorAlert.textContent = msg;
    shareErrorAlert.style.display = 'block';
  }

  function showShareActionFeedback(msg) {
    shareActionFeedback.textContent = msg;
    shareActionFeedback.style.display = 'block';
  }

  function showShareActionError(msg) {
    shareActionError.textContent = msg;
    shareActionError.style.display = 'block';
  }

  function hideShareAlerts() {
    shareErrorAlert.style.display = 'none';
    shareActionFeedback.style.display = 'none';
    shareActionError.style.display = 'none';
  }

  // ===========================================================================
  // SECTION 3: RECEIVE ATTENDANCE (RECEIVER)
  // ===========================================================================
  function setupReceiveListeners() {
    joinRoomBtn.addEventListener('click', handleJoinRoom);
    receiveRefreshBtn.addEventListener('click', handleReceiverManualRefresh);
    importAttendanceBtn.addEventListener('click', handleImportToAttendance);

    leaveRoomBtn.addEventListener('click', () => {
      leaveReceiverRoom();
    });
  }

  async function handleJoinRoom() {
    hideReceiveAlerts();

    const rawCode = receiveRoomCode.value.trim();
    const { isValid, normalized, error } = SupabaseService.validateRoomCode(rawCode);

    if (!isValid) {
      showReceiveError(error);
      return;
    }

    joinRoomBtn.disabled = true;
    joinRoomBtn.textContent = 'Connecting...';

    const res = await window.supabaseService.getRoom(normalized);

    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = 'Join Room';

    if (!res.success) {
      showReceiveError(res.error || `Room "${normalized}" not found.`);
      return;
    }

    const room = res.room;

    if (!room.is_active) {
      showReceiveError(`Room "${normalized}" is currently closed.`);
      return;
    }

    if (res.isExpired) {
      showReceiveError(`Room "${normalized}" has expired.`);
      return;
    }

    // Activate receiver view
    activateReceiverView(room);
    saveReceiverState(room);
  }

  function activateReceiverView(room) {
    receiverActiveRoom = room;
    receiveSetupCard.style.display = 'none';
    receiveActiveCard.style.display = 'block';
    receiveDisplayCode.textContent = room.room_code;

    updateReceiverData(room);
    startReceiverCountdown(room.expires_at);

    // Subscribe to Realtime Postgres Changes
    connectReceiverRealtime(room.room_code);
  }

  function updateReceiverData(room) {
    receiverActiveRoom = room;
    const presentArr = room.attendance_data?.present || [];
    latestReceivedPresentList = presentArr;

    receivePresentCount.textContent = presentArr.length;
    receiveLastUpdated.textContent = room.updated_at ? new Date(room.updated_at).toLocaleTimeString() : 'Just now';

    if (presentArr.length > 0) {
      receivePreviewRolls.textContent = presentArr.join(', ');
      importAttendanceBtn.disabled = false;
    } else {
      receivePreviewRolls.textContent = '(Host has not shared present rolls yet)';
      importAttendanceBtn.disabled = true;
    }
  }

  function startReceiverCountdown(expiresAtIso) {
    stopReceiverCountdown();

    const targetMs = new Date(expiresAtIso).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = targetMs - now;

      if (diff <= 0) {
        stopReceiverCountdown();
        receiveCountdown.textContent = '00:00';
        receiveCountdown.classList.add('urgent');
        receiveLiveStatus.textContent = 'EXPIRED';
        receiveLivePill.className = 'room-live-pill expired';
        importAttendanceBtn.disabled = true;
        receiveRefreshBtn.disabled = true;
        showReceiveActionError('This attendance room has expired.');
        return;
      }

      receiveCountdown.textContent = SupabaseService.formatRemainingTime(diff);
      receiveCountdown.classList.toggle('urgent', diff < 120000);
      receiveLiveStatus.textContent = 'Room Active';
      receiveLivePill.className = 'room-live-pill';
      receiveRefreshBtn.disabled = false;
      if (latestReceivedPresentList.length > 0) {
        importAttendanceBtn.disabled = false;
      }
    };

    tick();
    receiverTimerInterval = setInterval(tick, 1000);
  }

  function stopReceiverCountdown() {
    if (receiverTimerInterval) {
      clearInterval(receiverTimerInterval);
      receiverTimerInterval = null;
    }
  }

  function connectReceiverRealtime(roomCode) {
    receiveSyncStatus.textContent = '⚡ Connecting Realtime...';
    receiveSyncStatus.style.color = '#d97706';

    window.supabaseService.subscribeToRoom(
      roomCode,
      (updatedRoom) => {
        // Called whenever host updates attendance_rooms!
        if (updatedRoom && updatedRoom.room_code === roomCode) {
          // If room closed by host
          if (!updatedRoom.is_active) {
            receiveLiveStatus.textContent = 'CLOSED';
            receiveLivePill.className = 'room-live-pill closed';
            importAttendanceBtn.disabled = true;
            receiveRefreshBtn.disabled = true;
            showReceiveActionError('This room was closed by the host.');
            return;
          }

          updateReceiverData(updatedRoom);
          showReceiveActionFeedback(`⚡ Live Update Received! (${updatedRoom.attendance_data?.present?.length || 0} students)`);
        }
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          receiveSyncStatus.textContent = '⚡ Realtime Live Syncing';
          receiveSyncStatus.style.color = '#059669';
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          receiveSyncStatus.textContent = '⚠️ Realtime fallback (Use Get Latest)';
          receiveSyncStatus.style.color = '#dc2626';
        }
      }
    );
  }

  async function handleReceiverManualRefresh() {
    hideReceiveAlerts();

    if (!receiverActiveRoom) return;

    receiveRefreshBtn.disabled = true;
    receiveRefreshBtn.textContent = 'Refreshing...';

    const res = await window.supabaseService.getRoom(receiverActiveRoom.room_code);

    receiveRefreshBtn.disabled = false;
    receiveRefreshBtn.textContent = 'Get Latest';

    if (!res.success) {
      showReceiveActionError(res.error || 'Failed to refresh room data.');
      return;
    }

    if (!res.room.is_active) {
      receiveLiveStatus.textContent = 'CLOSED';
      receiveLivePill.className = 'room-live-pill closed';
      importAttendanceBtn.disabled = true;
      showReceiveActionError('This room has been closed.');
      return;
    }

    if (res.isExpired) {
      receiveLiveStatus.textContent = 'EXPIRED';
      receiveLivePill.className = 'room-live-pill expired';
      importAttendanceBtn.disabled = true;
      showReceiveActionError('This attendance room has expired.');
      return;
    }

    updateReceiverData(res.room);
    showReceiveActionFeedback('✓ Attendance data refreshed from server.');
  }

  /**
   * Import shared present rolls into the existing attendance input field.
   * DOES NOT automatically submit attendance.
   */
  function handleImportToAttendance() {
    hideReceiveAlerts();

    if (latestReceivedPresentList.length === 0) {
      showReceiveActionError('No present student roll numbers available to import.');
      return;
    }

    // Format list as comma-separated values
    const formattedRolls = latestReceivedPresentList.join(', ');

    // Populate into EXISTING attendance input field
    rollInput.value = formattedRolls;

    // Switch to Attendance tab so user can review and click "Apply Attendance"
    switchTab('tab-attendance');

    // Trigger visual feedback on Attendance tab
    showResult(`✓ Imported ${latestReceivedPresentList.length} shared roll numbers. Review and click "Apply Attendance" to mark.`);
  }

  function leaveReceiverRoom() {
    stopReceiverCountdown();
    window.supabaseService.unsubscribeFromRoom();
    receiverActiveRoom = null;
    latestReceivedPresentList = [];
    receiveActiveCard.style.display = 'none';
    receiveSetupCard.style.display = 'block';
    clearSavedReceiverState();
  }

  function showReceiveError(msg) {
    receiveErrorAlert.textContent = msg;
    receiveErrorAlert.style.display = 'block';
  }

  function showReceiveActionFeedback(msg) {
    receiveActionFeedback.textContent = msg;
    receiveActionFeedback.style.display = 'block';
  }

  function showReceiveActionError(msg) {
    receiveActionError.textContent = msg;
    receiveActionError.style.display = 'block';
  }

  function hideReceiveAlerts() {
    receiveErrorAlert.style.display = 'none';
    receiveActionFeedback.style.display = 'none';
    receiveActionError.style.display = 'none';
  }

  // ===========================================================================
  // SECTION 4: SETTINGS MODAL & STATE PERSISTENCE
  // ===========================================================================
  function setupSettingsListeners() {
    settingsBtn.addEventListener('click', async () => {
      // Load current values
      let currentUrl = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG.SUPABASE_URL : '';
      let currentKey = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG.SUPABASE_ANON_KEY : '';

      try {
        const stored = await chrome.storage.local.get(['custom_supabase_url', 'custom_supabase_anon_key']);
        if (stored.custom_supabase_url) currentUrl = stored.custom_supabase_url;
        if (stored.custom_supabase_anon_key) currentKey = stored.custom_supabase_anon_key;
      } catch (e) {}

      cfgSupabaseUrl.value = currentUrl;
      cfgSupabaseKey.value = currentKey;
      cfgFeedback.style.display = 'none';
      settingsModal.style.display = 'flex';
    });

    closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
    cancelSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });

    saveSettingsBtn.addEventListener('click', async () => {
      const url = cfgSupabaseUrl.value.trim();
      const key = cfgSupabaseKey.value.trim();

      await chrome.storage.local.set({
        custom_supabase_url: url,
        custom_supabase_anon_key: key
      });

      await window.supabaseService.initClient();

      cfgFeedback.textContent = 'Settings saved successfully!';
      cfgFeedback.style.display = 'block';

      setTimeout(() => {
        settingsModal.style.display = 'none';
      }, 1000);
    });
  }

  async function saveHostState(room) {
    try {
      await chrome.storage.local.set({ host_room_code: room.room_code });
    } catch (e) {}
  }

  async function clearSavedHostState() {
    try {
      await chrome.storage.local.remove(['host_room_code']);
    } catch (e) {}
  }

  async function saveReceiverState(room) {
    try {
      await chrome.storage.local.set({ receiver_room_code: room.room_code });
    } catch (e) {}
  }

  async function clearSavedReceiverState() {
    try {
      await chrome.storage.local.remove(['receiver_room_code']);
    } catch (e) {}
  }

  async function restoreSavedRoomStates() {
    try {
      const stored = await chrome.storage.local.get(['host_room_code', 'receiver_room_code']);

      // Check Host Room
      if (stored.host_room_code) {
        const res = await window.supabaseService.getRoom(stored.host_room_code);
        if (res.success && res.room && res.isAvailable) {
          shareRoomCode.value = res.room.room_code;
          activateHostView(res.room);
        } else {
          clearSavedHostState();
        }
      }

      // Check Receiver Room
      if (stored.receiver_room_code) {
        const res = await window.supabaseService.getRoom(stored.receiver_room_code);
        if (res.success && res.room && res.isAvailable) {
          receiveRoomCode.value = res.room.room_code;
          activateReceiverView(res.room);
        } else {
          clearSavedReceiverState();
        }
      }
    } catch (e) {
      console.warn('Failed restoring room states:', e);
    }
  }
});
