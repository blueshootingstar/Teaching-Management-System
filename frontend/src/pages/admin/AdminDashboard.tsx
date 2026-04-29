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
  type?: 'text' | 'number' | 'select' | 'date' | 'timeSlot';
  required?: boolean;
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

const statusOptions = [
  { label: '正常', value: '正常' },
  { label: '休学', value: '休学' },
  { label: '毕业', value: '毕业' }
];

const sexOptions = [
  { label: '男', value: '男' },
  { label: '女', value: '女' }
];

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
  if (resourceKey === 'semesters') {
    extraText.push(record.is_current ? '当前 当前学期' : '否 非当前');
  }
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
  const matched = value?.match(/^(星期[一二三四五六日])(.+)$/);
  const [weekday, period] = matched ? [matched[1], matched[2]] : [undefined, undefined];

  const emit = (nextWeekday?: string, nextPeriod?: string) => {
    if (nextWeekday && nextPeriod) {
      onChange?.(`${nextWeekday}${nextPeriod}`);
    } else {
      onChange?.('');
    }
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        placeholder="星期"
        value={weekday}
        options={weekdayOptions}
        onChange={(next) => emit(next, period)}
      />
      <Select
        placeholder="节次"
        value={period}
        options={periodOptions}
        onChange={(next) => emit(weekday, next)}
      />
    </Space.Compact>
  );
}

function ResourcePanel({ config, onChanged }: { config: ResourceConfig; onChanged?: () => void | Promise<void> }) {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [form] = Form.useForm();
  const selectedClassroom = Form.useWatch('classroom', form);
  const classroomOptions = config.fields.find((field) => field.name === 'classroom')?.options || [];
  const selectedClassroomOption = classroomOptions.find((option) => option.value === selectedClassroom);

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
    const values = await form.validateFields();
    for (const field of config.fields) {
      if (field.type === 'date' && values[field.name]) {
        values[field.name] = values[field.name].format('YYYY-MM-DD');
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
              <Button
                type={record.is_current ? 'primary' : 'default'}
                disabled={!!record.is_current}
                onClick={() => setCurrentSemester(record)}
              >
                {record.is_current ? '当前学期' : '设为当前'}
              </Button>
            )}
            {canEdit && (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record);
                  const nextValues = { ...record };
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
          <Input.Search
            allowClear
            placeholder={`搜索${config.title}`}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 280 }}
          />
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
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {config.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              extra={
                field.name === 'capacity' && selectedClassroomOption?.capacity
                  ? `所选教室最大容量：${selectedClassroomOption.capacity} 人`
                  : undefined
              }
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined}
            >
              {field.type === 'number' ? (
                <InputNumber
                  min={field.name === 'capacity' ? 1 : undefined}
                  max={field.name === 'capacity' ? selectedClassroomOption?.capacity : undefined}
                  style={{ width: '100%' }}
                />
              ) : field.type === 'date' ? (
                <DatePicker style={{ width: '100%' }} />
              ) : field.type === 'timeSlot' ? (
                <TimeSlotSelect />
              ) : field.type === 'select' ? (
                <Select options={field.options || []} />
              ) : (
                <Input />
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

  const loadBase = async () => {
    const [offeringData, semesterData, rankingData] = await Promise.all([
      request.get<AnyRecord[]>('/admin/course-offerings'),
      request.get<AnyRecord[]>('/admin/semesters'),
      request.get<AnyRecord[]>('/statistics/course-ranking')
    ]);
    setOfferings(offeringData);
    setSemesters(semesterData);
    setRankingRows(rankingData);
    setOfferingId(offeringData[0]?.offering_id);
    setSemesterId(semesterData[0]?.semester_id);
  };

  useEffect(() => {
    loadBase();
  }, []);

  const loadCourseStat = async () => {
    if (!offeringId) return;
    const rows = await request.get<AnyRecord[]>(`/statistics/course/${offeringId}`);
    setCourseStat(rows[0] || null);
  };

  const loadSemesterStat = async () => {
    if (!semesterId) return;
    const rows = await request.get<AnyRecord[]>(`/statistics/semester/${semesterId}`);
    setSemesterRows(rows);
  };

  return (
    <div className="page-card">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Select
            style={{ minWidth: 320 }}
            value={offeringId}
            options={offerings.map((item) => ({
              label: `${item.semester} ${item.course_name} ${item.teacher_name}`,
              value: item.offering_id
            }))}
            onChange={setOfferingId}
          />
          <Button type="primary" onClick={loadCourseStat}>课程成绩统计</Button>
        </Space>
        {courseStat && (
          <div className="stats-grid">
            <Statistic title="选课人数" value={courseStat.selected_count || 0} />
            <Statistic title="已录成绩" value={courseStat.graded_count || 0} />
            <Statistic title="平均分" value={courseStat.average_score || 0} precision={2} />
            <Statistic title="最高分" value={courseStat.max_score || 0} />
            <Statistic title="最低分" value={courseStat.min_score || 0} />
            <Statistic title="优秀人数" value={courseStat.excellent_count || 0} />
          </div>
        )}
        <Space wrap>
          <Select
            style={{ minWidth: 220 }}
            value={semesterId}
            options={semesters.map((item) => ({ label: item.semester_name, value: item.semester_id }))}
            onChange={setSemesterId}
          />
          <Button onClick={loadSemesterStat}>学期选课人数</Button>
        </Space>
        <Table
          rowKey="offering_id"
          columns={[
            { title: '课程号', dataIndex: 'course_id' },
            { title: '课程名', dataIndex: 'course_name' },
            { title: '教师', dataIndex: 'teacher_name' },
            { title: '选课人数', dataIndex: 'selected_count' }
          ]}
          dataSource={semesterRows}
        />
        <Typography.Title level={5}>课程平均分排名</Typography.Title>
        <Table
          rowKey="course_id"
          columns={[
            { title: '课程号', dataIndex: 'course_id' },
            { title: '课程名', dataIndex: 'course_name' },
            { title: '平均分', dataIndex: 'average_score' }
          ]}
          dataSource={rankingRows}
        />
      </Space>
    </div>
  );
}

export default function AdminDashboard() {
  const [departments, setDepartments] = useState<AnyRecord[]>([]);
  const [courses, setCourses] = useState<AnyRecord[]>([]);
  const [teachers, setTeachers] = useState<AnyRecord[]>([]);
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [classrooms, setClassrooms] = useState<AnyRecord[]>([]);

  const loadOptions = async () => {
    const [deptData, courseData, teacherData, semesterData, classroomData] = await Promise.all([
      request.get<AnyRecord[]>('/admin/departments'),
      request.get<AnyRecord[]>('/admin/courses'),
      request.get<AnyRecord[]>('/admin/teachers'),
      request.get<AnyRecord[]>('/admin/semesters'),
      request.get<AnyRecord[]>('/admin/classrooms')
    ]);
    setDepartments(deptData);
    setCourses(courseData);
    setTeachers(teacherData);
    setSemesters(semesterData);
    setClassrooms(classroomData);
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const deptOptions = departments.map((item) => ({ label: item.dept_name, value: item.dept_id }));
  const courseOptions = courses.map((item) => ({ label: `${item.course_id} ${item.course_name}`, value: item.course_id }));
  const teacherOptions = teachers.map((item) => ({ label: `${item.staff_id} ${item.name}`, value: item.staff_id }));
  const semesterOptions = semesters.map((item) => ({ label: item.semester_name, value: item.semester_id }));
  const classroomOptions = classrooms.map((item) => ({
    label: `${item.classroom_id}（${item.capacity}人）`,
    value: item.classroom_id,
    capacity: Number(item.capacity)
  }));

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
          { title: '状态', dataIndex: 'status' }
        ],
        fields: [
          { name: 'student_id', label: '学号', required: true },
          { name: 'name', label: '姓名', required: true },
          { name: 'sex', label: '性别', type: 'select', options: sexOptions, required: true },
          { name: 'date_of_birth', label: '出生日期', type: 'date', required: true },
          { name: 'native_place', label: '籍贯', required: true },
          { name: 'mobile_phone', label: '电话', required: true },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true },
          { name: 'status', label: '状态', type: 'select', options: statusOptions, required: true }
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
          { title: '职称', dataIndex: 'professional_ranks' },
          { title: '院系', dataIndex: 'dept_name' },
          { title: '薪资', dataIndex: 'salary' }
        ],
        fields: [
          { name: 'staff_id', label: '教工号', required: true },
          { name: 'name', label: '姓名', required: true },
          { name: 'sex', label: '性别', type: 'select', options: sexOptions, required: true },
          { name: 'date_of_birth', label: '出生日期', type: 'date', required: true },
          { name: 'professional_ranks', label: '职称', required: true },
          { name: 'salary', label: '薪资', type: 'number', required: true },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true }
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
          { title: '学时', dataIndex: 'credit_hours' },
          { title: '院系', dataIndex: 'dept_name' }
        ],
        fields: [
          { name: 'course_id', label: '课程号', required: true },
          { name: 'course_name', label: '课程名', required: true },
          { name: 'credit', label: '学分', type: 'number', required: true },
          { name: 'credit_hours', label: '学时', type: 'number', required: true },
          { name: 'dept_id', label: '院系', type: 'select', options: deptOptions, required: true }
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
          {
            title: '当前学期',
            dataIndex: 'is_current',
            render: (value) => (value ? <Tag color="green">当前</Tag> : <Tag>否</Tag>)
          }
        ],
        fields: []
      },
      {
        key: 'course-offerings',
        title: '开课管理',
        endpoint: '/admin/course-offerings',
        idField: 'offering_id',
        columns: [
          { title: '开课 ID', dataIndex: 'offering_id' },
          { title: '学期', dataIndex: 'semester' },
          { title: '课程', dataIndex: 'course_name' },
          { title: '教师', dataIndex: 'teacher_name' },
          { title: '时间', dataIndex: 'class_time' },
          { title: '教室', dataIndex: 'classroom' },
          { title: '容量', dataIndex: 'capacity' },
          { title: '状态', dataIndex: 'status' }
        ],
        fields: [
          { name: 'semester', label: '学期', type: 'select', options: semesterOptions, required: true },
          { name: 'course_id', label: '课程', type: 'select', options: courseOptions, required: true },
          { name: 'staff_id', label: '教师', type: 'select', options: teacherOptions, required: true },
          { name: 'class_time', label: '上课时间', type: 'timeSlot', required: true },
          { name: 'capacity', label: '容量', type: 'number', required: true },
          { name: 'status', label: '状态', type: 'select', options: offeringStatusOptions, required: true },
          { name: 'classroom', label: '教室', type: 'select', options: classroomOptions, required: true }
        ]
      }
    ],
    [deptOptions, courseOptions, teacherOptions, semesterOptions, classroomOptions]
  );

  return (
    <Tabs
      items={[
        ...resources.map((resource) => ({
          key: resource.key,
          label: resource.title,
          children: <ResourcePanel config={resource} onChanged={loadOptions} />
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
