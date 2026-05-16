import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  MailOutlined,
  NotificationOutlined,
  SendOutlined
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import request from '../../api/request';
import type { AnyRecord, CurrentUser } from '../../types';

interface MailboxDrawerProps {
  user: CurrentUser;
}

function formatTime(value: unknown) {
  return String(value || '').replace('T', ' ').slice(0, 19);
}

function substitutionStatusText(status: string) {
  if (status === 'accepted') return '已同意';
  if (status === 'rejected') return '已拒绝';
  return '待处理';
}

function substitutionStatusColor(status: string) {
  if (status === 'accepted') return 'green';
  if (status === 'rejected') return 'red';
  return 'orange';
}

function itemTitle(item: AnyRecord) {
  if (item.item_type === 'notification') return item.title || '通知';
  return `${item.requester_teacher_name || '教师'} 请求第 ${item.week_no} 周代课`;
}

function itemSummary(item: AnyRecord) {
  if (item.item_type === 'notification') return item.content || '';
  return `${item.course_name || '-'} ${item.semester || ''} ${item.class_time || ''}`;
}

export default function MailboxDrawer({ user }: MailboxDrawerProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [historyRows, setHistoryRows] = useState<AnyRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AnyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm();
  const isAdmin = user.role === 'admin';

  const loadUnread = async () => {
    if (isAdmin) return;
    const data = await request.get<AnyRecord>('/mailbox/unread-count');
    setUnreadCount(Number(data.unread_count || 0));
  };

  const loadMailbox = async () => {
    if (isAdmin) return;
    const data = await request.get<AnyRecord[]>('/mailbox');
    setRows(data);
    await loadUnread();
  };

  const loadHistory = async () => {
    if (!isAdmin) return;
    const data = await request.get<AnyRecord[]>('/admin/notifications');
    setHistoryRows(data);
  };

  useEffect(() => {
    loadUnread();
  }, [isAdmin]);

  const openDrawer = async () => {
    setOpen(true);
    setSelected(null);
    if (isAdmin) {
      await loadHistory();
    } else {
      await loadMailbox();
    }
  };

  const selectMail = async (item: AnyRecord) => {
    setSelected(item);
    if (!item.read_at) {
      await request.put(`/mailbox/${item.recipient_id}/read`);
      await loadMailbox();
      setSelected({ ...item, read_at: new Date().toISOString() });
    }
  };

  const respondSubstitution = async (item: AnyRecord, action: 'accept' | 'reject') => {
    await request.post(`/teacher/substitution-requests/${item.mail_item_id}/${action}`);
    message.success(action === 'accept' ? '已同意代课申请' : '已拒绝代课申请');
    window.dispatchEvent(new Event('substitution-updated'));
    await loadMailbox();
    setSelected({
      ...item,
      substitution_status: action === 'accept' ? 'accepted' : 'rejected'
    });
  };

  const sendNotification = async () => {
    const values = await form.validateFields();
    await request.post('/admin/notifications', values);
    message.success('通知已发送');
    form.resetFields();
    await loadHistory();
  };

  const confirmDeleteNotification = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await request.delete(`/admin/notifications/${deleteTarget.mail_item_id}`);
      message.success('通知已删除');
      if (selected?.mail_item_id === deleteTarget.mail_item_id) setSelected(null);
      await loadHistory();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const mailboxList = useMemo(() => (
    <List
      dataSource={rows}
      locale={{ emptyText: '暂无消息' }}
      renderItem={(item) => (
        <List.Item
          className={!item.read_at ? 'mailbox-unread' : undefined}
          onClick={() => selectMail(item)}
          actions={[
            <Tag key="type" color={item.item_type === 'notification' ? 'green' : 'orange'}>
              {item.item_type === 'notification' ? '通知' : '代课'}
            </Tag>
          ]}
        >
          <List.Item.Meta
            title={
              <Space>
                {!item.read_at && <Badge status="processing" />}
                <Typography.Text strong={!item.read_at}>{itemTitle(item)}</Typography.Text>
              </Space>
            }
            description={
              <Space direction="vertical" size={2}>
                <Typography.Text type="secondary">{item.sender_name || '-'} · {formatTime(item.created_at)}</Typography.Text>
                <Typography.Text ellipsis>{itemSummary(item)}</Typography.Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  ), [rows]);

  const notificationHistory = (
    <List
      dataSource={historyRows}
      locale={{ emptyText: '暂无发送历史' }}
      renderItem={(item) => (
        <List.Item
          onClick={() => setSelected(item)}
          actions={[
            <Tooltip key="delete" title="删除通知">
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                loading={deleting && deleteTarget?.mail_item_id === item.mail_item_id}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(item);
                }}
              />
            </Tooltip>
          ]}
        >
          <List.Item.Meta
            title={item.title}
            description={`发送人：${item.sender_name || '系统管理员'} · 发送时间：${formatTime(item.created_at)} · 收件 ${item.recipient_count || 0} · 已读 ${item.read_count || 0}`}
          />
        </List.Item>
      )}
    />
  );

  const detailFooter = selected?.item_type === 'substitution' && user.role === 'teacher' && selected.substitution_status === 'pending'
    ? [
      <Button key="reject" danger icon={<CloseOutlined />} onClick={() => respondSubstitution(selected, 'reject')}>
        拒绝
      </Button>,
      <Button key="accept" type="primary" icon={<CheckOutlined />} onClick={() => respondSubstitution(selected, 'accept')}>
        同意
      </Button>
    ]
    : [
      <Button key="close" type="primary" onClick={() => setSelected(null)}>
        关闭
      </Button>
    ];

  const renderNotificationDetail = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginBottom: 8 }}>
          {selected?.title}
        </Typography.Title>
        <Typography.Text type="secondary">
          {isAdmin ? '系统管理员' : selected?.sender_name || '-'} · {formatTime(selected?.created_at)}
        </Typography.Text>
      </div>
      {isAdmin && (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="收件">{selected?.recipient_count || 0}</Descriptions.Item>
          <Descriptions.Item label="已读">{selected?.read_count || 0}</Descriptions.Item>
        </Descriptions>
      )}
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.8 }}>
        {selected?.content}
      </Typography.Paragraph>
    </Space>
  );

  const renderSubstitutionDetail = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginBottom: 8 }}>
          {itemTitle(selected || {})}
        </Typography.Title>
        <Typography.Text type="secondary">
          {selected?.sender_name || selected?.requester_teacher_name || '-'} · {formatTime(selected?.created_at)}
        </Typography.Text>
      </div>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="申请教师">{selected?.requester_teacher_name}</Descriptions.Item>
        <Descriptions.Item label="课程">{selected?.course_name}</Descriptions.Item>
        <Descriptions.Item label="学期/周次">{selected?.semester} 第 {selected?.week_no} 周</Descriptions.Item>
        <Descriptions.Item label="时间/教室">{selected?.class_time} / {selected?.classroom}</Descriptions.Item>
        <Descriptions.Item label="原因">{selected?.substitution_reason || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={substitutionStatusColor(selected?.substitution_status)}>
            {substitutionStatusText(selected?.substitution_status)}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );

  return (
    <>
      <Badge dot={!isAdmin && unreadCount > 0}>
        <Button
          icon={isAdmin ? <NotificationOutlined /> : <MailOutlined />}
          onClick={openDrawer}
        >
          {isAdmin ? '通知' : '信箱'}
        </Button>
      </Badge>
      <Drawer
        title={isAdmin ? '通知发送' : '信箱'}
        width={520}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
      >
        {isAdmin ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Form form={form} layout="vertical" initialValues={{ scope: 'all' }}>
              <Form.Item name="scope" label="发送范围" rules={[{ required: true, message: '请选择发送范围' }]}>
                <Select
                  placeholder="请选择发送范围"
                  options={[
                    { label: '所有教师和学生', value: 'all' },
                    { label: '全体学生', value: 'students' },
                    { label: '全体教师', value: 'teachers' }
                  ]}
                />
              </Form.Item>
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入通知标题' }]}>
                <Input maxLength={100} placeholder="例如 调课通知" />
              </Form.Item>
              <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入通知内容' }]}>
                <Input.TextArea rows={5} placeholder="请输入完整通知内容" />
              </Form.Item>
              <Button type="primary" icon={<SendOutlined />} onClick={sendNotification}>
                发送通知
              </Button>
            </Form>
            <Typography.Title level={5}>发送历史</Typography.Title>
            {notificationHistory}
          </Space>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {mailboxList}
          </Space>
        )}
      </Drawer>
      <Modal
        title={selected?.item_type === 'substitution' ? '代课申请' : '通知详情'}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={detailFooter}
        width={680}
        destroyOnClose
      >
        {selected?.item_type === 'substitution' ? renderSubstitutionDetail() : renderNotificationDetail()}
      </Modal>
      <Modal
        title="删除通知"
        open={!!deleteTarget}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={deleting}
        onOk={confirmDeleteNotification}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        destroyOnClose
      >
        <Typography.Paragraph>
          删除后，教师和学生收件箱中的这条通知也会删除。
        </Typography.Paragraph>
        <Typography.Text strong>{deleteTarget?.title}</Typography.Text>
      </Modal>
    </>
  );
}
