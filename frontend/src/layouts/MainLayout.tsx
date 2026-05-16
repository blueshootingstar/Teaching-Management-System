import { LogoutOutlined, ReadOutlined } from '@ant-design/icons';
import { Button, Form, Input, Layout, Modal, Space, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CurrentUser } from '../types';
import MailboxDrawer from '../pages/shared/MailboxDrawer';
import request from '../api/request';

const { Header, Content } = Layout;

export default function MainLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}') as CurrentUser;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const changePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await request.put('/auth/password', values);
      message.success('密码已修改，请重新登录');
      setPasswordOpen(false);
      passwordForm.resetFields();
      logout();
    } catch (error: any) {
      const fieldErrors = error?.response?.data?.data?.fieldErrors;
      if (fieldErrors) {
        passwordForm.setFields(Object.entries(fieldErrors).map(([name, errors]) => ({ name, errors: [String(errors)] })));
      }
    }
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-brand">
          <ReadOutlined style={{ fontSize: 28, color: '#3730a3' }} />
          <Typography.Text className="app-title">教学事务管理系统</Typography.Text>
        </div>
        <Space className="app-user" size={12}>
          <Typography.Text className="app-user-name">
            {user.displayName} · {user.role}
          </Typography.Text>
          {user.userId && <MailboxDrawer user={user} />}
          <Button onClick={() => setPasswordOpen(true)}>修改密码</Button>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Space>
      </Header>
      <Content className="app-content">{children}</Content>
      <Modal
        title="修改密码"
        open={passwordOpen}
        onOk={changePassword}
        onCancel={() => setPasswordOpen(false)}
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="old_password" label="旧密码" rules={[{ required: true, message: '请输入旧密码' }]}>
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '新密码至少 6 位' }]}
          >
            <Input.Password placeholder="至少6位，例如 abc123" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
