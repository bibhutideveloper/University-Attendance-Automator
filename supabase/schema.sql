-- =============================================================================
-- University Attendance Automator - Supabase Schema
-- Table: attendance_rooms
-- Realtime Synchronization & Row-Level Security (RLS)
-- =============================================================================

-- 1. Create table for attendance rooms
CREATE TABLE IF NOT EXISTS attendance_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL UNIQUE,
  attendance_data JSONB NOT NULL DEFAULT '{"present": []}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 2. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_rooms_code 
  ON attendance_rooms (room_code);

CREATE INDEX IF NOT EXISTS idx_attendance_rooms_active_expiry 
  ON attendance_rooms (room_code, is_active, expires_at);

-- 3. Configure Realtime replication
-- Replica identity FULL ensures all row data is broadcast during UPDATE events
ALTER TABLE attendance_rooms REPLICA IDENTITY FULL;

-- Add table to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_rooms;
  END IF;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE attendance_rooms ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies if re-running
DROP POLICY IF EXISTS "Allow public read access to rooms" ON attendance_rooms;
DROP POLICY IF EXISTS "Allow public insert of attendance rooms" ON attendance_rooms;
DROP POLICY IF EXISTS "Allow public update of attendance rooms" ON attendance_rooms;

-- Policy 1: Read access
-- Any student/faculty with the room code can read active and expired rooms
CREATE POLICY "Allow public read access to rooms"
  ON attendance_rooms
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy 2: Insert access
-- Allows creating a room with a valid code format (uppercase, 3-30 chars, alphanumeric + _ -)
-- and an expiry time set in the future
CREATE POLICY "Allow public insert of attendance rooms"
  ON attendance_rooms
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    room_code ~ '^[A-Z0-9_-]{3,30}$' AND
    expires_at > timezone('utc'::text, now())
  );

-- Policy 3: Update access
-- Allows updating room attendance_data, expires_at, and is_active (for close room)
CREATE POLICY "Allow public update of attendance rooms"
  ON attendance_rooms
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Optional periodic maintenance function (deactivates expired rooms)
CREATE OR REPLACE FUNCTION deactivate_expired_rooms()
RETURNS void AS $$
BEGIN
  UPDATE attendance_rooms
  SET is_active = false
  WHERE is_active = true AND expires_at <= timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
