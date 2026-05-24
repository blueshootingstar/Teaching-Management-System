import { LogoutOutlined, ReadOutlined } from '@ant-design/icons';
import { Button, Form, Input, Layout, Modal, Space, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnyRecord, CurrentUser } from '../types';
import MailboxDrawer from '../pages/shared/MailboxDrawer';
import request from '../api/request';

const { Header, Content } = Layout;

export default function MainLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}') as CurrentUser;
  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (!user.userId || !['student', 'teacher'].includes(user.role)) {
      setProfile(null);
      return;
    }
    request.get<AnyRecord | null>(`/${user.role}/profile`)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user.role, user.userId]);

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
  const profileItems = getHeaderProfileItems(user, profile);

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-brand">
          <ReadOutlined style={{ fontSize: 28, color: '#3730a3' }} />
          <Typography.Text className="app-title">教学事务管理系统</Typography.Text>
        </div>
        <Space className="app-user" size={12}>
          <div className="app-user-profile">
            <Typography.Text className="app-user-name">
              {user.displayName}
            </Typography.Text>
            {profileItems.length > 0 && (
              <div className="app-profile-line">
                {profileItems.map(([label, value]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    {value}
                  </span>
                ))}
              </div>
            )}
          </div>
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

function getHeaderProfileItems(user: CurrentUser, profile: AnyRecord | null): Array<[string, string]> {
  if (user.role === 'student') {
    return [
      ['学号', String(profile?.student_id || user.studentId || '-')],
      ['院系', String(profile?.dept_name || '-')],
      ['学籍', String(profile?.status_name || '-')]
    ];
  }
  if (user.role === 'teacher') {
    return [
      ['教工号', String(profile?.staff_id || user.staffId || '-')],
      ['院系', String(profile?.dept_name || '-')],
      ['职称', String(profile?.professional_rank_name || '-')]
    ];
  }
  return [];
}
