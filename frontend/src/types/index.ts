export type UserRole = 'admin' | 'teacher' | 'student';

export interface CurrentUser {
  userId: number;
  username: string;
  role: UserRole;
  displayName: string;
  studentId?: string | null;
  staffId?: string | null;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type AnyRecord = Record<string, any>;
