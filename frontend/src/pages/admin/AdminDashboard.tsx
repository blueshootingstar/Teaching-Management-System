import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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
  selectionWindowOpen?: boolean | null;
  onToggleSelectionWindow?: (isOpen: boolean) => void | Promise<void>;
}

function ResourcePanel({ config, onChanged, selectionWindowOpen, onToggleSelectionWindow }: ResourcePanelProps) {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
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

  const toggleCourseSelectionWindow = async () => {
    await onToggleSelectionWindow?.(!selectionWindowOpen);
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
              <Tag color={selectionWindowOpen ? 'green' : selectionWindowOpen === false ? 'red' : 'default'}>
                {selectionWindowOpen === null ? '读取选课状态' : selectionWindowOpen ? '选课开放中' : '选课已关闭'}
              </Tag>
              <Button danger={!!selectionWindowOpen} disabled={selectionWindowOpen === null} onClick={toggleCourseSelectionWindow}>
                {selectionWindowOpen ? '关闭选课' : '开启选课'}
              </Button>
            </>
          )}
          <Input.Search allowClear placeholder={`搜索${config.title}`} value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
          <Button onClick={() => setKeyword('')}>重置</Button>
          <Button icon={<ReloadOutlined />} onClick={load} />
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
    </div>
  );
}

function StatisticsPanel() {
  const [offerings, setOfferings] = useState<AnyRecord[]>([]);
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [courseStat, setCourseStat] = useState<AnyRecord | null>(null);
  const [semesterRows, setSemesterRows] = useState<AnyRecord[]>([]);
  const [rankingRows, setRankingRows] = useState<AnyRecord[]>([]);
  const [offeringId, setOfferingId] = useState<number | undefined>();
  const [semesterId, setSemesterId] = useState<string | undefined>();
  const [baseLoading, setBaseLoading] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [semesterLoading, setSemesterLoading] = useState(false);

  const loadBase = async () => {
    setBaseLoading(true);
    try {
      const [offeringData, semesterData, rankingData] = await Promise.all([
        request.get<AnyRecord[]>('/admin/course-offerings'),
        request.get<AnyRecord[]>('/admin/semesters'),
        request.get<AnyRecord[]>('/statistics/course-ranking')
      ]);
      const firstOfferingId = offeringData[0]?.offering_id;
      const currentSemester = semesterData.find((item) => Number(item.is_current) === 1) || semesterData[0];
      const firstSemesterId = currentSemester?.semester_id;

      setOfferings(offeringData);
      setSemesters(semesterData);
      setRankingRows(rankingData);
      setOfferingId(firstOfferingId);
      setSemesterId(firstSemesterId);

      const [courseRows, semesterStatRows] = await Promise.all([
        firstOfferingId ? request.get<AnyRecord[]>(`/statistics/course/${firstOfferingId}`) : Promise.resolve([]),
        firstSemesterId ? request.get<AnyRecord[]>(`/statistics/semester/${firstSemesterId}`) : Promise.resolve([])
      ]);
      setCourseStat(courseRows[0] || null);
      setSemesterRows(semesterStatRows);
    } finally {
      setBaseLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const loadCourseStat = async (targetOfferingId = offeringId) => {
    if (!targetOfferingId) {
      setCourseStat(null);
      return;
    }
    setCourseLoading(true);
    try {
      const rows = await request.get<AnyRecord[]>(`/statistics/course/${targetOfferingId}`);
      setCourseStat(rows[0] || null);
    } finally {
      setCourseLoading(false);
    }
  };

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

  const reloadAll = async () => {
    await loadBase();
  };

  const selectedOffering = offerings.find((item) => item.offering_id === offeringId);
  const selectedSemester = semesters.find((item) => item.semester_id === semesterId);

  return (
    <div className="statistics-dashboard">
      <div className="statistics-hero">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>统计分析</Typography.Title>
          <Typography.Text type="secondary">
            查看课程成绩、学期选课人数和课程平均分排名。
          </Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={baseLoading} onClick={reloadAll}>
          刷新
        </Button>
      </div>

      <section className="stats-section">
        <div className="stats-section-header">
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>课程成绩概览</Typography.Title>
            <Typography.Text type="secondary">
              {selectedOffering
                ? `${selectedOffering.semester} · ${selectedOffering.course_name} · ${selectedOffering.teacher_name}`
                : '请选择一条开课记录'}
            </Typography.Text>
          </div>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 340 }}
            value={offeringId}
            placeholder="选择开课记录"
            options={offerings.map((item) => ({
              label: `${item.semester} ${item.course_name} ${item.teacher_name}`,
              value: item.offering_id
            }))}
            onChange={(value) => {
              setOfferingId(value);
              loadCourseStat(value);
            }}
          />
        </div>

        <div className="stats-grid stats-grid-compact">
          {[
            ['选课人数', courseStat?.selected_count || 0],
            ['已录成绩', courseStat?.graded_count || 0],
            ['平均分', courseStat?.average_score || 0, 2],
            ['最高分', courseStat?.max_score || 0],
            ['最低分', courseStat?.min_score || 0],
            ['优秀人数', courseStat?.excellent_count || 0]
          ].map(([title, value, precision]) => (
            <div className="stat-tile" key={String(title)}>
              <Statistic
                loading={courseLoading || baseLoading}
                title={title}
                value={Number(value)}
                precision={typeof precision === 'number' ? precision : undefined}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="statistics-split">
        <section className="stats-section">
          <div className="stats-section-header">
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>学期选课分析</Typography.Title>
              <Typography.Text type="secondary">
                {selectedSemester?.semester_name || '请选择学期'}
              </Typography.Text>
            </div>
            <Select
              style={{ minWidth: 220 }}
              value={semesterId}
              placeholder="选择学期"
              options={semesters.map((item) => ({ label: item.semester_name, value: item.semester_id }))}
              onChange={(value) => {
                setSemesterId(value);
                loadSemesterStat(value);
              }}
            />
          </div>
          <Table
            rowKey="offering_id"
            size="middle"
            loading={semesterLoading || baseLoading}
            columns={[
              { title: '课程号', dataIndex: 'course_id', width: 110 },
              { title: '课程名', dataIndex: 'course_name' },
              { title: '教师', dataIndex: 'teacher_name', width: 120 },
              { title: '选课人数', dataIndex: 'selected_count', width: 110, align: 'center' }
            ]}
            dataSource={semesterRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        </section>

        <section className="stats-section">
          <div className="stats-section-header">
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>课程平均分排名</Typography.Title>
              <Typography.Text type="secondary">按已录入成绩的平均分排序。</Typography.Text>
            </div>
          </div>
          <Table
            rowKey="course_id"
            size="middle"
            loading={baseLoading}
            columns={[
              {
                title: '排名',
                width: 72,
                align: 'center',
                render: (_value, _record, index) => <Tag color={index < 3 ? 'blue' : undefined}>{index + 1}</Tag>
              },
              { title: '课程名', dataIndex: 'course_name' },
              {
                title: '平均分',
                dataIndex: 'average_score',
                width: 100,
                align: 'right',
                render: (value) => Number(value || 0).toFixed(2)
              }
            ]}
            dataSource={rankingRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        </section>
      </div>
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
  const [selectionWindowOpen, setSelectionWindowOpen] = useState<boolean | null>(null);

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
      selectionWindowData
    ] = await Promise.all([
      request.get<AnyRecord[]>('/admin/departments'),
      request.get<AnyRecord[]>('/admin/courses'),
      request.get<AnyRecord[]>('/admin/teachers'),
      request.get<AnyRecord[]>('/admin/semesters'),
      request.get<AnyRecord[]>('/admin/classrooms'),
      request.get<AnyRecord[]>('/admin/student-statuses'),
      request.get<AnyRecord[]>('/admin/professional-ranks'),
      request.get<AnyRecord[]>('/admin/course-hour-options'),
      request.get<AnyRecord>('/admin/course-selection-window')
    ]);
    setDepartments(deptData);
    setCourses(courseData);
    setTeachers(teacherData);
    setSemesters(semesterData);
    setClassrooms(classroomData);
    setStudentStatuses(statusData);
    setProfessionalRanks(rankData);
    setCourseHourOptions(courseHourData);
    setSelectionWindowOpen(Boolean(selectionWindowData.is_open));
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

  const toggleCourseSelectionWindow = async (isOpen: boolean) => {
    const data = await request.put<AnyRecord>('/admin/course-selection-window', { is_open: isOpen });
    setSelectionWindowOpen(Boolean(data.is_open));
    message.success(isOpen ? '已开启选课' : '已关闭选课');
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
          { title: '容量', dataIndex: 'capacity' },
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
              selectionWindowOpen={selectionWindowOpen}
              onToggleSelectionWindow={toggleCourseSelectionWindow}
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
