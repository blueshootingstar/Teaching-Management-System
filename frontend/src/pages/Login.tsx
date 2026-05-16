import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import request from '../api/request';
import type { CurrentUser } from '../types';

interface LoginResult {
  token: string;
  user: CurrentUser;
}


export default function Login() {
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    const data = await request.post<LoginResult>('/auth/login', values);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    message.success('登录成功');
    navigate(`/${data.user.role}`, { replace: true });
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Typography.Title level={2}>教学事务管理系统</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
          欢迎登录，请验证您的身份
        </Typography.Text>
        <Form layout="vertical" className="login-form" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input size="large" prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="账号 (admin / 学号 / 教工号)" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="密码 (默认测试密码 123456)" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block style={{ marginTop: 8 }}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
