import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import request from '../../api/request';
import type { AnyRecord } from '../../types';

interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'timeSlot' | 'password';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string | number; capacity?: number }[];
}

interface ResourceConfig {
  key: string;
  title: string;
  endpoint: string;
  idField: string;
  columns: ColumnsType<AnyRecord>;
  fields: FieldConfig[];
}

type SystemWindowKey = 'course_selection_open' | 'grade_query_open' | 'grade_upload_open';
type SystemWindows = Record<SystemWindowKey, boolean | null>;

const systemWindowControls: Array<{
  key: SystemWindowKey;
  label: string;
  openText: string;
  closedText: string;
  openButton: string;
  closeButton: string;
  openConfirm: string;
  closeConfirm: string;
}> = [
  {
    key: 'course_selection_open',
    label: '选课',
    openText: '选课开放中',
    closedText: '选课已关闭',
    openButton: '开启选课',
    closeButton: '关闭选课',
    openConfirm: '开启后学生可以进行选课和退课操作。',
    closeConfirm: '关闭后学生将不能继续选课或退课。'
  },
  {
    key: 'grade_query_open',
    label: '成绩查询',
    openText: '成绩查询开放中',
    closedText: '成绩查询已关闭',
    openButton: '开启成绩查询',
    closeButton: '关闭成绩查询',
    openConfirm: '开启后学生可以查看当前学期成绩和绩点。',
    closeConfirm: '关闭后学生将不能查看当前学期成绩，历史学期成绩仍可查看。'
  },
  {
    key: 'grade_upload_open',
    label: '成绩上传',
    openText: '成绩上传开放中',
    closedText: '成绩上传已关闭',
    openButton: '开启成绩上传',
    closeButton: '关闭成绩上传',
    openConfirm: '开启后教师可以录入或修改学生成绩。',
    closeConfirm: '关闭后教师将不能录入或修改学生成绩。'
  }
];

function formatDate(value: unknown) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

const sexOptions = [
  { label: '男', value: '男' },
  { label: '女', value: '女' }
];

const studentIdPattern = /^1\d{3}$/;
const teacherIdPattern = /^0\d{3}$/;

const offeringStatusOptions = [
  { label: '开放', value: 'open' },
  { label: '关闭', value: 'closed' }
];

const weekdayOptions = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'].map((day) => ({
  label: day,
  value: day
}));

const periodOptions = ['1-2', '3-4', '5-6', '5-8', '7-8', '9-10'].map((period) => ({
  label: `${period}节`,
  value: period
}));

function matchRecordKeyword(record: AnyRecord, keyword: string, resourceKey?: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  const extraText: string[] = [];
  if (resourceKey === 'semesters') extraText.push(record.is_current ? '当前 当前学期' : '否 非当前');
  if (resourceKey === 'course-offerings') {
    if (record.status === 'open') extraText.push('开放 可选');
    if (record.status === 'closed') extraText.push('关闭 不可选');
  }
  const searchText = [...Object.values(record), ...extraText]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(' ');
  return searchText.includes(normalizedKeyword);
}

function TimeSlotSelect({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  const [weekday, setWeekday] = useState<string>();
  const [period, setPeriod] = useState<string>();

  useEffect(() => {
    const matched = value?.match(/^(星期[一二三四五六日])(.+)$/);
    setWeekday(matched?.[1]);
    setPeriod(matched?.[2]);
  }, [value]);

  const emit = (nextWeekday?: string, nextPeriod?: string) => {
    if (nextWeekday && nextPeriod) {
      onChange?.(`${nextWeekday}${nextPeriod}`);
    }
  };

  const changeWeekday = (nextWeekday: string) => {
    setWeekday(nextWeekday);
    emit(nextWeekday, period);
  };

  const changePeriod = (nextPeriod: string) => {
    setPeriod(nextPeriod);
    emit(weekday, nextPeriod);
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select placeholder="请选择星期，例如星期一" value={weekday} options={weekdayOptions} onChange={changeWeekday} />
      <Select placeholder="请选择节次，例如1-2节" value={period} options={periodOptions} onChange={changePeriod} />
    </Space.Compact>
  );
}

function requiredMessage(field: FieldConfig) {
  if (field.type === 'select' || field.type === 'date' || field.type === 'timeSlot') {
    return `请选择${field.label}`;
  }
  return `请输入${field.label}`;
}

interface ResourcePanelProps {
  config: ResourceConfig;
  onChanged?: () => void | Promise<void>;
  systemWindows?: SystemWindows;
  onToggleSystemWindow?: (key: SystemWindowKey, isOpen: boolean) => void | Promise<void>;
}

function ResourcePanel({ config, onChanged, systemWindows, onToggleSystemWindow }: ResourcePanelProps) {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [confirmingWindow, setConfirmingWindow] = useState<{
    control: (typeof systemWindowControls)[number];
    nextOpen: boolean;
  } | null>(null);
  const [systemWindowSaving, setSystemWindowSaving] = useState(false);
  const [form] = Form.useForm();
  const selectedClassroom = Form.useWatch('classroom', form);
  const classroomOptions = config.fields.find((field) => field.name === 'classroom')?.options || [];
  const selectedClassroomOption = classroomOptions.find((option) => option.value === selectedClassroom);
  const rulesForField = (field: FieldConfig) => {
    const rules: any[] = [];
    if (field.required) rules.push({ required: true, message: requiredMessage(field) });
    if (field.name === 'capacity') {
      rules.push({
        validator: (_: unknown, value: unknown) => {
          const maxCapacity = selectedClassroomOption?.capacity;
          if (!maxCapacity || value === undefined || value === null || value === '') {
            return Promise.resolve();
          }
          if (Number(value) > Number(maxCapacity)) {
            return Promise.reject(new Error(`课程容量不能超过教室容量 ${maxCapacity}`));
          }
          return Promise.resolve();
        }
      });
    }
    if (field.name === 'student_id') {
      rules.push({ pattern: studentIdPattern, message: '学号需为 1 开头的 4 位数字' });
    }
    if (field.name === 'staff_id') {
      rules.push({ pattern: teacherIdPattern, message: '教工号需为 0 开头的 4 位数字' });
    }
    return rules.length > 0 ? rules : undefined;
  };

  const load = async () => {
    const data = await request.get<AnyRecord[]>(config.endpoint);
    setRows(data);
  };

  useEffect(() => {
    setKeyword('');
    load();
  }, [config.endpoint]);

  const filteredRows = useMemo(
    () => rows.filter((record) => matchRecordKeyword(record, keyword, config.key)),
    [config.key, keyword, rows]
  );

  const reloadAfterChange = async () => {
    await load();
    await onChanged?.();
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      for (const field of config.fields) {
        if (field.type === 'date' && values[field.name]) {
          values[field.name] = values[field.name].format('YYYY-MM-DD');
        }
        if (field.type === 'password' && !values[field.name]) {
          delete values[field.name];
        }
      }
      if (editing) {
        await request.put(`${config.endpoint}/${editing[config.idField]}`, values);
        message.success('已更新');
      } else {
        await request.post(config.endpoint, values);
        message.success('已新增');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await reloadAfterChange();
    } catch (error: any) {
      const fieldErrors = error?.response?.data?.data?.fieldErrors;
      if (fieldErrors) {
        form.setFields(Object.entries(fieldErrors).map(([name, errors]) => ({ name, errors: [String(errors)] })));
      }
    }
  };

  const remove = async (record: AnyRecord) => {
    await request.delete(`${config.endpoint}/${record[config.idField]}`);
    message.success('已删除');
    await reloadAfterChange();
  };

  const setCurrentSemester = async (record: AnyRecord) => {
    await request.put(`${config.endpoint}/${record[config.idField]}/current`);
    message.success('已设置当前学期');
    await reloadAfterChange();
  };

  const createNextSemester = async () => {
    await request.post(config.endpoint, {});
    message.success('已新增下一学期');
    await reloadAfterChange();
  };

  const confirmSystemWindowToggle = (control: (typeof systemWindowControls)[number]) => {
    const current = systemWindows?.[control.key];
    if (current === null || current === undefined) return;
    setConfirmingWindow({ control, nextOpen: !current });
  };

  const submitSystemWindowToggle = async () => {
    if (!confirmingWindow) return;
    setSystemWindowSaving(true);
    try {
      await onToggleSystemWindow?.(confirmingWindow.control.key, confirmingWindow.nextOpen);
      setConfirmingWindow(null);
    } finally {
      setSystemWindowSaving(false);
    }
  };

  const canEdit = config.key !== 'semesters';
  const canRemove = config.key !== 'semesters';
  const columns: ColumnsType<AnyRecord> = [
    ...config.columns.map((column) => ({ ...column, ellipsis: true })),
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: config.key === 'semesters' ? 140 : 150,
      render: (_, record) => {
        const recordCanDelete = record.can_delete === undefined ? true : !!Number(record.can_delete);
        return (
          <Space>
            {config.key === 'semesters' && (
              <Button type={record.is_current ? 'primary' : 'default'} disabled={!!record.is_current} onClick={() => setCurrentSemester(record)}>
                {record.is_current ? '当前学期' : '设为当前'}
              </Button>
            )}
            {canEdit && (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record);
                  const nextValues: AnyRecord = { ...record, password: undefined };
                  for (const field of config.fields) {
                    if (field.type === 'date' && record[field.name]) {
                      nextValues[field.name] = dayjs(record[field.name]);
                    }
                  }
                  form.setFieldsValue(nextValues);
                  setOpen(true);
                }}
              />
            )}
            {canRemove && (
              recordCanDelete ? (
                <Popconfirm title="确认删除？" onConfirm={() => remove(record)}>
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ) : (
                <Tooltip title={record.delete_reason || '当前记录不能删除'}>
                  <span>
                    <Button danger disabled icon={<DeleteOutlined />} />
                  </span>
                </Tooltip>
              )
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="page-card">
      <div className="toolbar">
        <Typography.Title level={4}>{config.title}</Typography.Title>
        <Space wrap>
          {config.key === 'semesters' && (
            <>
              {systemWindowControls.map((control) => {
                const isOpen = systemWindows?.[control.key];
                return (
                  <Space key={control.key} size={4}>
                    <Tag color={isOpen ? 'green' : isOpen === false ? 'red' : 'default'}>
                      {isOpen === null || isOpen === undefined ? `读取${control.label}状态` : isOpen ? control.openText : control.closedText}
                    </Tag>
                    <Button danger={!!isOpen} disabled={isOpen === null || isOpen === undefined} onClick={() => confirmSystemWindowToggle(control)}>
                      {isOpen ? control.closeButton : control.openButton}
                    </Button>
                  </Space>
                );
              })}
            </>
          )}
          <Input.Search allowClear placeholder={`搜索${config.title}`} value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
          <Button onClick={() => setKeyword('')}>重置</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={config.key === 'semesters'
              ? createNextSemester
              : () => {
                setEditing(null);
                form.resetFields();
                setOpen(true);
              }}
          >
            {config.key === 'semesters' ? '新增下一学期' : '新增'}
          </Button>
        </Space>
      </div>
      <Table rowKey={config.idField} columns={columns} dataSource={filteredRows} scroll={{ x: 900 }} />
      <Modal
        title={editing ? `编辑${config.title}` : `新增${config.title}`}
        open={open}
        onOk={save}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {config.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              extra={field.name === 'capacity' && selectedClassroomOption?.capacity ? `所选教室最大容量：${selectedClassroomOption.capacity} 人` : undefined}
              rules={rulesForField(field)}
            >
              {field.type === 'number' ? (
                <InputNumber
                  min={field.name === 'capacity' ? 1 : undefined}
                  placeholder={field.placeholder}
                  style={{ width: '100%' }}
                />
              ) : field.type === 'date' ? (
                <DatePicker placeholder={field.placeholder} style={{ width: '100%' }} />
              ) : field.type === 'timeSlot' ? (
                <TimeSlotSelect />
              ) : field.type === 'select' ? (
                <Select placeholder={field.placeholder} options={field.options || []} />
              ) : field.type === 'password' ? (
                <Input.Password placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
      <Modal
        title={confirmingWindow ? `确认${confirmingWindow.nextOpen ? confirmingWindow.control.openButton : confirmingWindow.control.closeButton}？` : ''}
        open={!!confirmingWindow}
        onOk={submitSystemWindowToggle}
        onCancel={() => setConfirmingWindow(null)}
        okText={confirmingWindow?.nextOpen ? '确认开启' : '确认关闭'}
        cancelText="取消"
        confirmLoading={systemWindowSaving}
        okButtonProps={{ danger: confirmingWindow ? !confirmingWindow.nextOpen : false }}
      >
        <Typography.Text>
          {confirmingWindow
            ? confirmingWindow.nextOpen
              ? confirmingWindow.control.openConfirm
              : confirmingWindow.control.closeConfirm
            : ''}
        </Typography.Text>
      </Modal>
    </div>
  );
}

function StatisticsPanel() {
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [semesterRows, setSemesterRows] = useState<AnyRecord[]>([]);
  const [semesterId, setSemesterId] = useState<string | undefined>();
  const [activeStatsView, setActiveStatsView] = useState<'capacity' | 'grades' | 'departments' | 'teachers'>('capacity');
  const [baseLoading, setBaseLoading] = useState(false);
  const [semesterLoading, setSemesterLoading] = useState(false);

  const loadBase = async () => {
    setBaseLoading(true);
    try {
      const semesterData = await request.get<AnyRecord[]>('/admin/semesters');
      const currentSemester = semesterData.find((item) => Number(item.is_current) === 1) || semesterData[0];
      const firstSemesterId = currentSemester?.semester_id;

      setSemesters(semesterData);
      setSemesterId(firstSemesterId);

      const semesterStatRows = firstSemesterId
        ? await request.get<AnyRecord[]>(`/statistics/semester/${firstSemesterId}`)
        : [];
      setSemesterRows(semesterStatRows);
    } finally {
      setBaseLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const loadSemesterStat = async (targetSemesterId = semesterId) => {
    if (!targetSemesterId) {
      setSemesterRows([]);
      return;
    }
    setSemesterLoading(true);
    try {
      const rows = await request.get<AnyRecord[]>(`/statistics/semester/${targetSemesterId}`);
      setSemesterRows(rows);
    } finally {
      setSemesterLoading(false);
    }
  };

  const selectedSemester = semesters.find((item) => item.semester_id === semesterId);
  const formatPercent = (value: unknown) => `${Number(value || 0).toFixed(1)}%`;
  const semesterSummary = useMemo(() => {
    const totalOfferings = semesterRows.length;
    const totalSelected = semesterRows.reduce((sum, row) => sum + Number(row.selected_count || 0), 0);
    const totalCapacity = semesterRows.reduce((sum, row) => sum + Number(row.capacity || 0), 0);
    const totalGraded = semesterRows.reduce((sum, row) => sum + Number(row.graded_count || 0), 0);
    const totalPendingGrades = semesterRows.reduce((sum, row) => sum + Number(row.pending_grade_count || 0), 0);
    const openCount = semesterRows.filter((row) => row.status === 'open').length;
    const fullCount = semesterRows.filter((row) => Number(row.capacity || 0) > 0 && Number(row.selected_count || 0) >= Number(row.capacity || 0)).length;
    const lowEnrollmentCount = semesterRows.filter((row) => Number(row.selected_count || 0) > 0 && Number(row.selected_count || 0) < 5).length;
    const emptyEnrollmentCount = semesterRows.filter((row) => Number(row.selected_count || 0) === 0).length;
    const tightCapacityCount = semesterRows.filter((row) => {
      const selected = Number(row.selected_count || 0);
      const remaining = Number(row.remaining_capacity || 0);
      return selected > 0 && remaining > 0 && remaining <= 5;
    }).length;
    const pendingGradeCourseCount = semesterRows.filter((row) => Number(row.pending_grade_count || 0) > 0).length;
    const closedCount = semesterRows.filter((row) => row.status === 'closed').length;

    return {
      totalOfferings,
      openCount,
      totalSelected,
      totalCapacity,
      totalPendingGrades,
      fullCount,
      tightCapacityCount,
      lowEnrollmentCount,
      emptyEnrollmentCount,
      pendingGradeCourseCount,
      closedCount,
      averageSelected: totalOfferings > 0 ? totalSelected / totalOfferings : 0,
      utilizationRate: totalCapacity > 0 ? (totalSelected / totalCapacity) * 100 : 0,
      gradeCompletionRate: totalSelected > 0 ? (totalGraded / totalSelected) * 100 : 0
    };
  }, [semesterRows]);

  const capacityAttentionRows = useMemo(
    () => [...semesterRows]
      .filter((row) => {
        const selected = Number(row.selected_count || 0);
        const capacity = Number(row.capacity || 0);
        const remaining = Number(row.remaining_capacity || 0);
        return selected === 0 || (selected > 0 && selected < 5) || (capacity > 0 && selected >= capacity) || (selected > 0 && remaining > 0 && remaining <= 5);
      })
      .sort((a, b) => {
        const score = (row: AnyRecord) => {
          const selected = Number(row.selected_count || 0);
          const capacity = Number(row.capacity || 0);
          const remaining = Number(row.remaining_capacity || 0);
          if (capacity > 0 && selected >= capacity) return 4;
          if (selected > 0 && remaining > 0 && remaining <= 5) return 3;
          if (selected === 0) return 2;
          if (selected > 0 && selected < 5) return 1;
          return 0;
        };
        return score(b) - score(a) || Number(b.utilization_rate || 0) - Number(a.utilization_rate || 0);
      }),
    [semesterRows]
  );

  const gradePendingRows = useMemo(
    () => [...semesterRows]
      .filter((row) => Number(row.pending_grade_count || 0) > 0)
      .sort((a, b) => Number(b.pending_grade_count || 0) - Number(a.pending_grade_count || 0) || Number(a.grade_completion_rate || 0) - Number(b.grade_completion_rate || 0)),
    [semesterRows]
  );

  const teacherRows = useMemo<AnyRecord[]>(() => {
    const grouped = new Map<string, AnyRecord>();
    semesterRows.forEach((row) => {
      const key = String(row.staff_id || row.teacher_name);
      const current = grouped.get(key) || {
        staff_id: row.staff_id,
        teacher_name: row.teacher_name,
        offering_count: 0,
        selected_count: 0,
        capacity: 0,
        graded_count: 0,
        pending_grade_count: 0
      };
      current.offering_count += 1;
      current.selected_count += Number(row.selected_count || 0);
      current.capacity += Number(row.capacity || 0);
      current.graded_count += Number(row.graded_count || 0);
      current.pending_grade_count += Number(row.pending_grade_count || 0);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        average_selected: row.offering_count > 0 ? row.selected_count / row.offering_count : 0,
        utilization_rate: row.capacity > 0 ? (row.selected_count / row.capacity) * 100 : 0,
        grade_completion_rate: row.selected_count > 0 ? (row.graded_count / row.selected_count) * 100 : 0
      }))
      .sort((a: AnyRecord, b: AnyRecord) => Number(b.offering_count || 0) - Number(a.offering_count || 0) || Number(b.selected_count || 0) - Number(a.selected_count || 0));
  }, [semesterRows]);

  const deptRows = useMemo<AnyRecord[]>(() => {
    const grouped = new Map<string, AnyRecord>();
    semesterRows.forEach((row) => {
      const key = String(row.dept_id || row.dept_name || 'unknown');
      const current = grouped.get(key) || {
        dept_id: row.dept_id,
        dept_name: row.dept_name || '-',
        offering_count: 0,
        selected_count: 0,
        capacity: 0,
        pending_grade_count: 0
      };
      current.offering_count += 1;
      current.selected_count += Number(row.selected_count || 0);
      current.capacity += Number(row.capacity || 0);
      current.pending_grade_count += Number(row.pending_grade_count || 0);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        utilization_rate: row.capacity > 0 ? (row.selected_count / row.capacity) * 100 : 0
      }))
      .sort((a: AnyRecord, b: AnyRecord) => Number(b.offering_count || 0) - Number(a.offering_count || 0));
  }, [semesterRows]);

  const renderCapacityStatus = (_: unknown, record: AnyRecord) => {
    const selected = Number(record.selected_count || 0);
    const capacity = Number(record.capacity || 0);
    const remaining = Number(record.remaining_capacity || 0);
    if (capacity > 0 && selected >= capacity) return <Tag color="red">已满</Tag>;
    if (selected > 0 && remaining > 0 && remaining <= 5) return <Tag color="gold">余量紧张</Tag>;
    if (selected === 0) return <Tag>未选</Tag>;
    if (selected < 5) return <Tag color="orange">偏少</Tag>;
    return <Tag color="green">正常</Tag>;
  };
  const activeStatsMeta = {
    capacity: {
      title: '容量与选课关注',
      description: '展示已满、余量紧张、低选或空选课程。'
    },
    grades: {
      title: '成绩录入进度',
      description: '只展示仍有成绩未录入的课程。'
    },
    departments: {
      title: '院系开课汇总',
      description: '按课程所属院系统计课程供给和容量利用。'
    },
    teachers: {
      title: '教师教学负载',
      description: '按本学期开课数量和授课人次汇总。'
    }
  }[activeStatsView];

  return (
    <div className="statistics-dashboard">
      <div className="statistics-hero">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>统计分析</Typography.Title>
          <Typography.Text type="secondary">
            围绕当前学期的课程运行、容量风险、成绩录入和教学负载进行监控。
          </Typography.Text>
        </div>
        <Select
          style={{ minWidth: 240 }}
          value={semesterId}
          placeholder="选择学期"
          options={semesters.map((item) => ({ label: item.semester_name, value: item.semester_id }))}
          onChange={(value) => {
            setSemesterId(value);
            loadSemesterStat(value);
          }}
        />
      </div>

      <section className="stats-section">
        <div className="stats-section-header">
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>{activeStatsMeta.title}</Typography.Title>
            <Typography.Text type="secondary">{selectedSemester?.semester_name || '请选择学期'} · {activeStatsMeta.description}</Typography.Text>
          </div>
          <div className="stats-detail-switcher">
            {[
              ['capacity', '容量与选课'],
              ['grades', '成绩录入'],
              ['departments', '院系汇总'],
              ['teachers', '教师课程量']
            ].map(([key, label]) => (
              <Button
                key={key}
                type={activeStatsView === key ? 'primary' : 'default'}
                onClick={() => setActiveStatsView(key as 'capacity' | 'grades' | 'departments' | 'teachers')}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {activeStatsView === 'capacity' && (
          <>
            <div className="stats-grid stats-grid-inline">
              {[
                ['开课数', semesterSummary.totalOfferings],
                ['开放课程', semesterSummary.openCount],
                ['容量利用率', semesterSummary.utilizationRate, 1, '%'],
                ['已满课程', semesterSummary.fullCount],
                ['余量紧张', semesterSummary.tightCapacityCount],
                ['低选/空选', semesterSummary.lowEnrollmentCount + semesterSummary.emptyEnrollmentCount],
                ['关闭课程', semesterSummary.closedCount]
              ].map(([title, value, precision, suffix]) => (
                <div className="stat-tile" key={String(title)}>
                  <Statistic
                    loading={semesterLoading || baseLoading}
                    title={title}
                    value={Number(value)}
                    precision={typeof precision === 'number' ? precision : undefined}
                    suffix={suffix}
                  />
                </div>
              ))}
            </div>
            <Table
              rowKey="offering_id"
              size="small"
              loading={semesterLoading || baseLoading}
              style={{ marginTop: 12 }}
              columns={[
                { title: '课程号', dataIndex: 'course_id', width: 110 },
                { title: '课程名', dataIndex: 'course_name' },
                { title: '教师', dataIndex: 'teacher_name', width: 120 },
                {
                  title: '选课/容量',
                  width: 110,
                  align: 'center',
                  render: (_, record) => `${record.selected_count || 0}/${record.capacity || 0}`
                },
                { title: '剩余', dataIndex: 'remaining_capacity', width: 80, align: 'center' },
                {
                  title: '利用率',
                  dataIndex: 'utilization_rate',
                  width: 92,
                  align: 'right',
                  render: formatPercent
                },
                {
                  title: '关注点',
                  width: 100,
                  align: 'center',
                  render: renderCapacityStatus
                }
              ]}
              dataSource={capacityAttentionRows}
              pagination={capacityAttentionRows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            />
          </>
        )}

        {activeStatsView === 'grades' && (
          <>
            <div className="stats-grid stats-grid-inline">
              {[
                ['待录课程', semesterSummary.pendingGradeCourseCount],
                ['待录人数', semesterSummary.totalPendingGrades]
              ].map(([title, value, precision, suffix]) => (
                <div className="stat-tile" key={String(title)}>
                  <Statistic
                    loading={semesterLoading || baseLoading}
                    title={title}
                    value={Number(value)}
                    precision={typeof precision === 'number' ? precision : undefined}
                    suffix={suffix}
                  />
                </div>
              ))}
            </div>
            <Table
              rowKey="offering_id"
              size="small"
              loading={semesterLoading || baseLoading}
              style={{ marginTop: 12 }}
              columns={[
                { title: '课程名', dataIndex: 'course_name' },
                { title: '教师', dataIndex: 'teacher_name', width: 120 },
                { title: '选课', dataIndex: 'selected_count', width: 72, align: 'center' },
                { title: '已录', dataIndex: 'graded_count', width: 72, align: 'center' },
                { title: '未录', dataIndex: 'pending_grade_count', width: 72, align: 'center' },
                {
                  title: '完成率',
                  dataIndex: 'grade_completion_rate',
                  width: 92,
                  align: 'right',
                  render: formatPercent
                }
              ]}
              dataSource={gradePendingRows}
              pagination={gradePendingRows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            />
          </>
        )}

        {activeStatsView === 'departments' && (
          <>
            <div className="stats-grid stats-grid-inline">
              {[
                ['院系数', deptRows.length],
                ['开课数', semesterSummary.totalOfferings],
                ['容量利用率', semesterSummary.utilizationRate, 1, '%']
              ].map(([title, value, precision, suffix]) => (
                <div className="stat-tile" key={String(title)}>
                  <Statistic
                    loading={semesterLoading || baseLoading}
                    title={title}
                    value={Number(value)}
                    precision={typeof precision === 'number' ? precision : undefined}
                    suffix={suffix}
                  />
                </div>
              ))}
            </div>
            <Table
              rowKey={(record) => String(record.dept_id || record.dept_name)}
              size="small"
              loading={semesterLoading || baseLoading}
              style={{ marginTop: 12 }}
              columns={[
                { title: '院系', dataIndex: 'dept_name' },
                { title: '开课数', dataIndex: 'offering_count', width: 90, align: 'center' },
                { title: '选课人次', dataIndex: 'selected_count', width: 100, align: 'center' },
                { title: '容量', dataIndex: 'capacity', width: 90, align: 'center' },
                {
                  title: '利用率',
                  dataIndex: 'utilization_rate',
                  width: 92,
                  align: 'right',
                  render: formatPercent
                },
                { title: '待录成绩', dataIndex: 'pending_grade_count', width: 100, align: 'center' }
              ]}
              dataSource={deptRows}
              pagination={deptRows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            />
          </>
        )}

        {activeStatsView === 'teachers' && (
          <>
            <div className="stats-grid stats-grid-inline">
              {[
                ['授课教师', teacherRows.length],
                ['开课数', semesterSummary.totalOfferings],
                ['授课人次', semesterSummary.totalSelected],
                ['待录成绩人数', semesterSummary.totalPendingGrades]
              ].map(([title, value, precision]) => (
                <div className="stat-tile" key={String(title)}>
                  <Statistic
                    loading={semesterLoading || baseLoading}
                    title={title}
                    value={Number(value)}
                    precision={typeof precision === 'number' ? precision : undefined}
                  />
                </div>
              ))}
            </div>
            <Table
              rowKey={(record) => String(record.staff_id || record.teacher_name)}
              size="small"
              loading={semesterLoading || baseLoading}
              style={{ marginTop: 12 }}
              columns={[
                { title: '教师', dataIndex: 'teacher_name' },
                { title: '开课数', dataIndex: 'offering_count', width: 90, align: 'center' },
                { title: '授课人次', dataIndex: 'selected_count', width: 100, align: 'center' },
                {
                  title: '平均每课',
                  dataIndex: 'average_selected',
                  width: 100,
                  align: 'right',
                  render: (value) => Number(value || 0).toFixed(1)
                },
                { title: '待录成绩', dataIndex: 'pending_grade_count', width: 100, align: 'center' }
              ]}
              dataSource={teacherRows}
              pagination={teacherRows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  const [departments, setDepartments] = useState<AnyRecord[]>([]);
  const [courses, setCourses] = useState<AnyRecord[]>([]);
  const [teachers, setTeachers] = useState<AnyRecord[]>([]);
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [classrooms, setClassrooms] = useState<AnyRecord[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<AnyRecord[]>([]);
  const [professionalRanks, setProfessionalRanks] = useState<AnyRecord[]>([]);
  const [courseHourOptions, setCourseHourOptions] = useState<AnyRecord[]>([]);
  const [systemWindows, setSystemWindows] = useState<SystemWindows>({
    course_selection_open: null,
    grade_query_open: null,
    grade_upload_open: null
  });

  const loadOptions = async () => {
    const [
      deptData,
      courseData,
      teacherData,
      semesterData,
      classroomData,
      statusData,
      rankData,
      courseHourData,
      systemSettingsData
    ] = await Promise.all([
      request.get<AnyRecord[]>('/admin/departments'),
      request.get<AnyRecord[]>('/admin/courses'),
      request.get<AnyRecord[]>('/admin/teachers'),
      request.get<AnyRecord[]>('/admin/semesters'),
      request.get<AnyRecord[]>('/admin/classrooms'),
      request.get<AnyRecord[]>('/admin/student-statuses'),
      request.get<AnyRecord[]>('/admin/professional-ranks'),
      request.get<AnyRecord[]>('/admin/course-hour-options'),
      request.get<AnyRecord>('/admin/system-settings')
    ]);
    setDepartments(deptData);
    setCourses(courseData);
    setTeachers(teacherData);
    setSemesters(semesterData);
    setClassrooms(classroomData);
    setStudentStatuses(statusData);
    setProfessionalRanks(rankData);
    setCourseHourOptions(courseHourData);
    setSystemWindows({
      course_selection_open: Boolean(systemSettingsData.course_selection_open),
      grade_query_open: Boolean(systemSettingsData.grade_query_open),
      grade_upload_open: Boolean(systemSettingsData.grade_upload_open)
    });
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const deptOptions = departments.map((item) => ({ label: item.dept_name, value: item.dept_id }));
  const statusOptions = studentStatuses.map((item) => ({ label: item.status_name, value: item.status_code }));
  const rankOptions = professionalRanks.map((item) => ({ label: item.rank_name, value: item.rank_id }));
  const courseHourSelectOptions = courseHourOptions.map((item) => ({
    label: `${item.credit_hours} 学时 / ${item.required_weeks} 周`,
    value: item.credit_hours
  }));
  const courseOptions = courses.map((item) => ({ label: `${item.course_id} ${item.course_name}`, value: item.course_id }));
  const teacherOptions = teachers.map((item) => ({ label: `${item.staff_id} ${item.name}`, value: item.staff_id }));
  const semesterOptions = semesters.map((item) => ({ label: item.semester_name, value: item.semester_id }));
  const classroomOptions = classrooms.map((item) => ({
    label: `${item.classroom}（${item.capacity}人）`,
    value: item.classroom,
    capacity: Number(item.capacity)
  }));

  const toggleSystemWindow = async (key: SystemWindowKey, isOpen: boolean) => {
    const data = await request.put<AnyRecord>(`/admin/system-settings/${key}`, { is_open: isOpen });
    setSystemWindows({
      course_selection_open: Boolean(data.course_selection_open),
      grade_query_open: Boolean(data.grade_query_open),
      grade_upload_open: Boolean(data.grade_upload_open)
    });
    const label = systemWindowControls.find((item) => item.key === key)?.label || '功能';
    message.success(isOpen ? `已开启${label}` : `已关闭${label}`);
  };

  const resources = useMemo<ResourceConfig[]>(
    () => [
      {
        key: 'students',
        title: '学生管理',
        endpoint: '/admin/students',
        idField: 'student_id',
        columns: [
          { title: '学号', dataIndex: 'student_id' },
          { title: '姓名', dataIndex: 'name' },
          { title: '性别', dataIndex: 'sex' },
          { title: '院系', dataIndex: 'dept_name' },
          { title: '电话', dataIndex: 'mobile_phone' },
          { title: '状态', dataIndex: 'status_name' }
        ],
        fields: [
          { name: 'student_id', label: '学号', required: true, placeholder: '例如 1102（1开头4位数字）' },
          { name: 'name', label: '姓名', required: true, placeholder: '例如 张三' },
          { name: 'sex', label: '性别', type: 'select', options: sexOptions, required: true, placeholder: '请选择性别' },
          { name: 'date_of_birth', label: '出生日期', type: 'date', required: true, placeholder: '请选择出生日期' },
          { name: 'native_place', label: '籍贯', required: true, placeholder: '例如 上海' },
          { name: 'mobile_phone', label: '电话', required: true, placeholder: '例如 13800000000（5-20位数字）' },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true, placeholder: '请选择院系' },
          { name: 'status_code', label: '状态', type: 'select', options: statusOptions, required: true, placeholder: '请选择学籍状态' },
          { name: 'password', label: '初始/重置密码', type: 'password', placeholder: '至少6位，不填则使用默认密码或保持原密码' }
        ]
      },
      {
        key: 'teachers',
        title: '教师管理',
        endpoint: '/admin/teachers',
        idField: 'staff_id',
        columns: [
          { title: '教工号', dataIndex: 'staff_id' },
          { title: '姓名', dataIndex: 'name' },
          { title: '职称', dataIndex: 'professional_rank_name' },
          { title: '院系', dataIndex: 'dept_name' },
          { title: '薪资', dataIndex: 'salary' }
        ],
        fields: [
          { name: 'staff_id', label: '教工号', required: true, placeholder: '例如 0106（0开头4位数字）' },
          { name: 'name', label: '姓名', required: true, placeholder: '例如 李老师' },
          { name: 'sex', label: '性别', type: 'select', options: sexOptions, required: true, placeholder: '请选择性别' },
          { name: 'date_of_birth', label: '出生日期', type: 'date', required: true, placeholder: '请选择出生日期' },
          { name: 'professional_rank_id', label: '职称', type: 'select', options: rankOptions, required: true, placeholder: '请选择职称' },
          { name: 'salary', label: '薪资', type: 'number', required: true, placeholder: '例如 6800' },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true, placeholder: '请选择院系' },
          { name: 'password', label: '初始/重置密码', type: 'password', placeholder: '至少6位，不填则使用默认密码或保持原密码' }
        ]
      },
      {
        key: 'courses',
        title: '课程管理',
        endpoint: '/admin/courses',
        idField: 'course_id',
        columns: [
          { title: '课程号', dataIndex: 'course_id' },
          { title: '课程名', dataIndex: 'course_name' },
          { title: '学分', dataIndex: 'credit' },
          { title: '学时', dataIndex: 'credit_hours', render: (_, record) => `${record.credit_hours} 学时 / ${record.required_weeks} 周` },
          { title: '院系', dataIndex: 'dept_name' }
        ],
        fields: [
          { name: 'course_id', label: '课程号', required: true, placeholder: '例如 08305010（8位）' },
          { name: 'course_name', label: '课程名', required: true, placeholder: '例如 数据库实践' },
          { name: 'credit', label: '学分', type: 'number', required: true, placeholder: '例如 3' },
          { name: 'credit_hours', label: '学时', type: 'select', options: courseHourSelectOptions, required: true, placeholder: '请选择学时，例如 32 学时 / 8 周' },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true, placeholder: '请选择院系' }
        ]
      },
      {
        key: 'semesters',
        title: '学期管理',
        endpoint: '/admin/semesters',
        idField: 'semester_id',
        columns: [
          { title: '学期号', dataIndex: 'semester_id' },
          { title: '学期名', dataIndex: 'semester_name' },
          { title: '开始日期', dataIndex: 'start_date', render: formatDate },
          { title: '结束日期', dataIndex: 'end_date', render: formatDate },
          { title: '当前学期', dataIndex: 'is_current', render: (value) => (value ? <Tag color="green">当前</Tag> : <Tag>否</Tag>) }
        ],
        fields: []
      },
      {
        key: 'course-offerings',
        title: '开课管理',
        endpoint: '/admin/course-offerings',
        idField: 'offering_id',
        columns: [
          { title: '开课ID', dataIndex: 'offering_id' },
          { title: '学期', dataIndex: 'semester' },
          { title: '课程', dataIndex: 'course_name' },
          { title: '教师', dataIndex: 'teacher_name' },
          { title: '时间', dataIndex: 'class_time' },
          { title: '教室', dataIndex: 'classroom' },
          {
            title: '容量',
            dataIndex: 'capacity',
            render: (_, record) => `${record.selected_count ?? record.selection_count ?? 0}/${record.capacity ?? 0}`
          },
          { title: '状态', dataIndex: 'status' }
        ],
        fields: [
          { name: 'semester', label: '学期', type: 'select', options: semesterOptions, required: true, placeholder: '请选择学期' },
          { name: 'course_id', label: '课程', type: 'select', options: courseOptions, required: true, placeholder: '请选择课程' },
          { name: 'staff_id', label: '教师', type: 'select', options: teacherOptions, required: true, placeholder: '请选择教师' },
          { name: 'class_time', label: '上课时间', type: 'timeSlot', required: true },
          { name: 'capacity', label: '容量', type: 'number', required: true, placeholder: '例如 60' },
          { name: 'status', label: '状态', type: 'select', options: offeringStatusOptions, required: true, placeholder: '请选择开课状态' },
          { name: 'classroom', label: '教室', type: 'select', options: classroomOptions, required: true, placeholder: '请选择教室' }
        ]
      }
    ],
    [deptOptions, statusOptions, rankOptions, courseHourSelectOptions, courseOptions, teacherOptions, semesterOptions, classroomOptions]
  );

  return (
    <Tabs
      items={[
        ...resources.map((resource) => ({
          key: resource.key,
          label: resource.title,
          children: (
            <ResourcePanel
              config={resource}
              onChanged={loadOptions}
              systemWindows={systemWindows}
              onToggleSystemWindow={toggleSystemWindow}
            />
          )
        })),
        {
          key: 'statistics',
          label: '统计分析',
          children: <StatisticsPanel />
        }
      ]}
    />
  );
}
