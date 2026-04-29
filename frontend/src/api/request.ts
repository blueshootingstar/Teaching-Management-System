import axios from 'axios';
import { message } from 'antd';
import type { ApiResponse } from '../types';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<any>;
    if (body.code >= 200 && body.code < 300) {
      return body.data;
    }
    message.error(body.message || '请求失败');
    return Promise.reject(new Error(body.message || '请求失败'));
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '网络错误';
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else {
      message.error(msg);
    }
    return Promise.reject(error);
  }
);

const request = {
  get<T = any>(url: string, config?: any) {
    return http.get(url, config) as unknown as Promise<T>;
  },
  post<T = any>(url: string, data?: any, config?: any) {
    return http.post(url, data, config) as unknown as Promise<T>;
  },
  put<T = any>(url: string, data?: any, config?: any) {
    return http.put(url, data, config) as unknown as Promise<T>;
  },
  delete<T = any>(url: string, config?: any) {
    return http.delete(url, config) as unknown as Promise<T>;
  }
};

export default request;
