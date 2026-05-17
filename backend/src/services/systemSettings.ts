import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/mysql';

export const COURSE_SELECTION_OPEN_KEY = 'course_selection_open';
export const GRADE_QUERY_OPEN_KEY = 'grade_query_open';
export const GRADE_UPLOAD_OPEN_KEY = 'grade_upload_open';

export type SystemWindowKey =
  | typeof COURSE_SELECTION_OPEN_KEY
  | typeof GRADE_QUERY_OPEN_KEY
  | typeof GRADE_UPLOAD_OPEN_KEY;

export const SYSTEM_WINDOW_KEYS: SystemWindowKey[] = [
  COURSE_SELECTION_OPEN_KEY,
  GRADE_QUERY_OPEN_KEY,
  GRADE_UPLOAD_OPEN_KEY
];

function settingToBoolean(value: unknown) {
  return String(value || '0') === '1';
}

export function isSystemWindowKey(value: string): value is SystemWindowKey {
  return SYSTEM_WINDOW_KEYS.includes(value as SystemWindowKey);
}

export async function getBooleanSetting(key: SystemWindowKey, conn?: PoolConnection, lock = false) {
  const sql = `SELECT setting_value
     FROM system_settings
     WHERE setting_key = ?
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`;

  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(sql, [key]);
    return settingToBoolean(rows[0]?.setting_value);
  }

  const rows = await query<RowDataPacket[]>(sql, [key]);
  return settingToBoolean(rows[0]?.setting_value);
}

export async function setBooleanSetting(key: SystemWindowKey, isOpen: boolean) {
  const value = isOpen ? '1' : '0';
  await execute(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value)`,
    [key, value]
  );
}

export async function getSystemWindows() {
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value
     FROM system_settings
     WHERE setting_key IN (?, ?, ?)`,
    SYSTEM_WINDOW_KEYS
  );
  const values = new Map(rows.map((row) => [String(row.setting_key), settingToBoolean(row.setting_value)]));
  return {
    [COURSE_SELECTION_OPEN_KEY]: values.get(COURSE_SELECTION_OPEN_KEY) || false,
    [GRADE_QUERY_OPEN_KEY]: values.get(GRADE_QUERY_OPEN_KEY) || false,
    [GRADE_UPLOAD_OPEN_KEY]: values.get(GRADE_UPLOAD_OPEN_KEY) || false
  };
}

export function getCourseSelectionOpen(conn?: PoolConnection, lock = false) {
  return getBooleanSetting(COURSE_SELECTION_OPEN_KEY, conn, lock);
}

export function getGradeQueryOpen(conn?: PoolConnection, lock = false) {
  return getBooleanSetting(GRADE_QUERY_OPEN_KEY, conn, lock);
}

export function getGradeUploadOpen(conn?: PoolConnection, lock = false) {
  return getBooleanSetting(GRADE_UPLOAD_OPEN_KEY, conn, lock);
}

export function setCourseSelectionOpen(isOpen: boolean) {
  return setBooleanSetting(COURSE_SELECTION_OPEN_KEY, isOpen);
}

export function courseSelectionWindowPayload(isOpen: boolean) {
  return { is_open: isOpen };
}
