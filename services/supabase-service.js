/**
 * University Attendance Automator - Supabase Service
 * Handles room creation, real-time subscription, presence updates, and room expiry.
 */

class SupabaseService {
  constructor() {
    this.client = null;
    this.activeChannel = null;
    this.isConfigured = false;
  }

  /**
   * Normalize and validate room code.
   * Allowed characters: A-Z, 0-9, _, - (3 to 30 characters).
   */
  static normalizeRoomCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code.trim().toUpperCase();
  }

  static validateRoomCode(code) {
    const normalized = SupabaseService.normalizeRoomCode(code);
    const isValid = /^[A-Z0-9_-]{3,30}$/.test(normalized);
    return {
      isValid,
      normalized,
      error: isValid ? null : 'Room code must be 3-30 characters long and contain only letters, numbers, hyphens, or underscores (no spaces).'
    };
  }

  /**
   * Format remaining milliseconds into MM:SS or HH:MM:SS string.
   */
  static formatRemainingTime(ms) {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Check if Supabase credentials are configured.
   */
  async initClient() {
    let url = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.SUPABASE_URL) ? SUPABASE_CONFIG.SUPABASE_URL : '';
    let key = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.SUPABASE_ANON_KEY) ? SUPABASE_CONFIG.SUPABASE_ANON_KEY : '';

    // Allow overrides from chrome.storage.local if user updated via settings
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get(['custom_supabase_url', 'custom_supabase_anon_key']);
        if (stored.custom_supabase_url && stored.custom_supabase_anon_key) {
          url = stored.custom_supabase_url;
          key = stored.custom_supabase_anon_key;
        }
      } catch (e) {
        console.warn('Storage lookup failed:', e);
      }
    }

    url = (url || '').trim();
    key = (key || '').trim();

    // Check if placeholders are still present
    const isPlaceholder = !url || !key || 
      url.includes('your-project-id') || 
      key.includes('your-anon-key');

    if (isPlaceholder) {
      this.isConfigured = false;
      this.client = null;
      return {
        configured: false,
        error: 'Supabase credentials not configured. Please add your Supabase URL & Anon Key in config.js or settings.'
      };
    }

    try {
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        this.client = supabase.createClient(url, key, {
          auth: { persistSession: false },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
        this.isConfigured = true;
        return { configured: true };
      } else {
        this.isConfigured = false;
        return { configured: false, error: 'Supabase client library not loaded.' };
      }
    } catch (err) {
      this.isConfigured = false;
      return { configured: false, error: err.message };
    }
  }

  /**
   * Fetch room data by room code.
   */
  async getRoom(roomCode) {
    const init = await this.initClient();
    if (!init.configured) return { success: false, error: init.error, notConfigured: true };

    const { isValid, normalized, error } = SupabaseService.validateRoomCode(roomCode);
    if (!isValid) return { success: false, error };

    try {
      const { data, error: dbError } = await this.client
        .from('attendance_rooms')
        .select('*')
        .eq('room_code', normalized)
        .maybeSingle();

      if (dbError) {
        return { success: false, error: dbError.message };
      }

      if (!data) {
        return { success: false, notFound: true, error: `Room "${normalized}" does not exist.` };
      }

      const now = Date.now();
      const expiresAtMs = new Date(data.expires_at).getTime();
      const isExpired = expiresAtMs <= now;
      const isAvailable = data.is_active && !isExpired;

      return {
        success: true,
        room: data,
        isExpired,
        isAvailable,
        remainingMs: Math.max(0, expiresAtMs - now)
      };
    } catch (err) {
      return { success: false, error: err.message || 'Network error fetching room.' };
    }
  }

  /**
   * Create or update a room.
   */
  async createOrUpdateRoom(roomCode, durationMinutes, options = {}) {
    const init = await this.initClient();
    if (!init.configured) return { success: false, error: init.error, notConfigured: true };

    const { isValid, normalized, error } = SupabaseService.validateRoomCode(roomCode);
    if (!isValid) return { success: false, error };

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      return { success: false, error: 'Invalid room duration specified.' };
    }

    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    try {
      // Check if room already exists
      const existing = await this.getRoom(normalized);

      if (existing.success && existing.room) {
        const room = existing.room;
        const now = Date.now();
        const expiresAtMs = new Date(room.expires_at).getTime();
        const currentlyActive = room.is_active && expiresAtMs > now;

        // If room is active and update is not explicitly confirmed:
        if (currentlyActive && !options.allowUpdate) {
          return {
            success: false,
            roomAlreadyActive: true,
            existingRoom: room,
            remainingMs: expiresAtMs - now,
            error: `Room "${normalized}" is already active.`
          };
        }

        // Update the existing room
        const updatePayload = {
          expires_at: expiresAt,
          is_active: true,
          updated_at: nowIso
        };

        // If starting fresh or requested reset
        if (options.resetAttendance !== false) {
          updatePayload.attendance_data = { present: [] };
        }

        const { data, error: updateError } = await this.client
          .from('attendance_rooms')
          .update(updatePayload)
          .eq('room_code', normalized)
          .select()
          .single();

        if (updateError) {
          return { success: false, error: updateError.message };
        }

        return {
          success: true,
          isUpdated: true,
          room: data,
          remainingMs: duration * 60 * 1000,
          message: `Room "${normalized}" updated and active.`
        };
      }

      // Room does not exist yet -> Create new room
      const { data, error: insertError } = await this.client
        .from('attendance_rooms')
        .insert({
          room_code: normalized,
          attendance_data: { present: [] },
          expires_at: expiresAt,
          is_active: true,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select()
        .single();

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return {
        success: true,
        isCreated: true,
        room: data,
        remainingMs: duration * 60 * 1000,
        message: `Room "${normalized}" created successfully.`
      };
    } catch (err) {
      return { success: false, error: err.message || 'Network error creating room.' };
    }
  }

  /**
   * Save shared present roll numbers to the active room.
   * Completely replaces the previous present list.
   */
  async sharePresentRolls(roomCode, presentRolls) {
    const init = await this.initClient();
    if (!init.configured) return { success: false, error: init.error, notConfigured: true };

    const normalized = SupabaseService.normalizeRoomCode(roomCode);

    // Verify room is still active and unexpired
    const roomCheck = await this.getRoom(normalized);
    if (!roomCheck.success) {
      return { success: false, error: roomCheck.error };
    }

    if (!roomCheck.isAvailable) {
      const reason = !roomCheck.room.is_active ? 'Room has been closed.' : 'This attendance room has expired.';
      return { success: false, isExpired: true, error: reason };
    }

    // Ensure sorted, deduplicated numbers
    const cleanNumbers = Array.from(new Set(presentRolls.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 999)))
      .sort((a, b) => a - b);

    const nowIso = new Date().toISOString();

    try {
      const { data, error: updateError } = await this.client
        .from('attendance_rooms')
        .update({
          attendance_data: { present: cleanNumbers },
          updated_at: nowIso
        })
        .eq('room_code', normalized)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return {
        success: true,
        room: data,
        presentCount: cleanNumbers.length,
        presentList: cleanNumbers,
        updatedAt: nowIso,
        message: `Shared ${cleanNumbers.length} present students to room "${normalized}".`
      };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to update attendance in room.' };
    }
  }

  /**
   * Close a room (set is_active = false).
   */
  async closeRoom(roomCode) {
    const init = await this.initClient();
    if (!init.configured) return { success: false, error: init.error, notConfigured: true };

    const normalized = SupabaseService.normalizeRoomCode(roomCode);

    try {
      const { data, error: updateError } = await this.client
        .from('attendance_rooms')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('room_code', normalized)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return {
        success: true,
        room: data,
        message: `Room "${normalized}" has been closed.`
      };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to close room.' };
    }
  }

  /**
   * Subscribe to real-time updates for a specific room code.
   */
  subscribeToRoom(roomCode, onUpdate, onStatusChange) {
    if (!this.client) return null;

    const normalized = SupabaseService.normalizeRoomCode(roomCode);
    this.unsubscribeFromRoom();

    try {
      const channel = this.client
        .channel(`room_changes_${normalized}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'attendance_rooms',
            filter: `room_code=eq.${normalized}`
          },
          (payload) => {
            if (onUpdate && payload && payload.new) {
              onUpdate(payload.new);
            }
          }
        )
        .subscribe((status) => {
          if (onStatusChange) {
            onStatusChange(status);
          }
        });

      this.activeChannel = channel;
      return channel;
    } catch (err) {
      console.error('Realtime subscription error:', err);
      return null;
    }
  }

  /**
   * Unsubscribe from currently active Realtime channel.
   */
  unsubscribeFromRoom() {
    if (this.activeChannel && this.client) {
      try {
        this.client.removeChannel(this.activeChannel);
      } catch (e) {
        console.warn('Error removing channel:', e);
      }
      this.activeChannel = null;
    }
  }
}

// Make accessible to popup scripts
if (typeof window !== 'undefined') {
  window.supabaseService = new SupabaseService();
}
