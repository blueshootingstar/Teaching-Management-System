import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/mysql';

export const COURSE_SELECTION_OPEN_KEY = 'course_selection_open';

function settingToBoolean(value: unknown) {
  return String(value || '0') === '1';
}

export async function getCourseSelectionOpen(conn?: PoolConnection, lock = false) {
  const sql = `SELECT setting_value
     FROM system_settings
     WHERE setting_key = ?
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`;

  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(sql, [COURSE_SELECTION_OPEN_KEY]);
    return settingToBoolean(rows[0]?.setting_value);
  }

  const rows = await query<RowDataPacket[]>(sql, [COURSE_SELECTION_OPEN_KEY]);
  return settingToBoolean(rows[0]?.setting_value);
}

export async function setCourseSelectionOpen(isOpen: boolean) {
  const value = isOpen ? '1' : '0';
  await execute(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value)`,
    [COURSE_SELECTION_OPEN_KEY, value]
  );
}

export function courseSelectionWindowPayload(isOpen: boolean) {
  return { is_open: isOpen };
}
