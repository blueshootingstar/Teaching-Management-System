import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CurrentUser } from '../types';

const { Header, Content } = Layout;

export default function MainLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}') as CurrentUser;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-brand">
          <Typography.Text className="app-title">教学事务管理系统</Typography.Text>
        </div>
        <Space className="app-user" size={12}>
          <Typography.Text className="app-user-name">
            {user.displayName} · {user.role}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Space>
      </Header>
      <Content className="app-content">{children}</Content>
    </Layout>
  );
}
