import dotenv from 'dotenv';
import mysql, { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'school',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
  timezone: '+08:00'
});

export async function query<T = RowDataPacket[]>(sql: string, params: any[] = []) {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

export async function execute(sql: string, params: any[] = []) {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function getConnection(): Promise<PoolConnection> {
  return pool.getConnection();
}
