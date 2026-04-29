import { DeleteOutlined, ReloadOutlined, SearchOutlined, SelectOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Input,
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
import { useEffect, useMemo, useState } from 'react';
import request from '../../api/request';
import type { AnyRecord } from '../../types';
import GpaTrendChart from './GpaTrendChart';

const initialFilters = {
  keyword: '',
  hasCapacity: false,
  onlyUnselected: false
};

const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const periods = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'];

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('available');
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [availableRows, setAvailableRows] = useState<AnyRecord[]>([]);
  const [courseRows, setCourseRows] = useState<AnyRecord[]>([]);
  const [gradeRows, setGradeRows] = useState<AnyRecord[]>([]);
  const [currentSemesterId, setCurrentSemesterId] = useState<string>();
  const [courseSemester, setCourseSemester] = useState<string>();
  const [gradeSemester, setGradeSemester] = useState<string>();
  const [filters, setFilters] = useState(initialFilters);

  const loadSemesters = async () => {
    const data = await request.get<AnyRecord[]>('/student/semesters');
    setSemesters(data);
    const current = getDefaultSemester(data);
    setCurrentSemesterId(current);
    setCourseSemester((prev) => prev || current);
    setGradeSemester((prev) => prev || current);
    return current;
  };

  const loadAvailable = async (nextFilters = filters) => {
    const data = await request.get<AnyRecord[]>('/student/available-courses', {
      params: {
        keyword: nextFilters.keyword || undefined,
        hasCapacity: nextFilters.hasCapacity || undefined,
        onlyUnselected: nextFilters.onlyUnselected || undefined
      }
    });
    setAvailableRows(data);
  };

  const loadCourses = async (semester = courseSemester || currentSemesterId) => {
    const data = await request.get<AnyRecord[]>('/student/my-courses', {
      params: { semester }
    });
    setCourseRows(data);
  };

  const loadGrades = async () => {
    const data = await request.get<AnyRecord[]>('/student/my-grades');
    setGradeRows(data);
  };

  const reloadAll = async () => {
    const current = await loadSemesters();
    await Promise.all([loadAvailable(), loadCourses(courseSemester || current), loadGrades()]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const selectCourse = async (offeringId: number) => {
    try {
      await request.post('/student/select-course', { offeringId });
      message.success('选课成功');
      await reloadAll();
    } catch (error) {
      if (!(error instanceof Error) || !error.message) {
        message.error('选课失败');
      }
    }
  };

  const changeCourseSemester = async (semester: string) => {
    setCourseSemester(semester);
    await loadCourses(semester);
  };

  const dropCourse = async (selectionId: number) => {
    await request.delete(`/student/drop-course/${selectionId}`);
    message.success('退课成功');
    await reloadAll();
  };

  const resetFilters = async () => {
    setFilters(initialFilters);
    await loadAvailable(initialFilters);
  };

  const availableColumns: ColumnsType<AnyRecord> = [
    { title: '学期', dataIndex: 'semester' },
    { title: '课程号', dataIndex: 'course_id' },
    { title: '课程名', dataIndex: 'course_name' },
    { title: '学分', dataIndex: 'credit' },
    { title: '教师号', dataIndex: 'staff_id' },
    { title: '教师', dataIndex: 'teacher_name' },
    { title: '时间', dataIndex: 'class_time' },
    { title: '教室', dataIndex: 'classroom' },
    {
      title: '容量',
      render: (_, record) => `${record.selected_count || 0}/${record.capacity || 0}`
    },
    { title: '余量', dataIndex: 'remaining_capacity' },
    {
      title: '状态',
      render: (_, record) => (
        <Space>
          {record.status === 'closed' && <Tag>已关闭</Tag>}
          {record.is_selected ? <Tag color="green">已选</Tag> : <Tag>未选</Tag>}
          {Number(record.same_course_selected) === 1 && <Tag color="orange">已选同课</Tag>}
          {Number(record.time_conflicted) === 1 && <Tag color="red">时间冲突</Tag>}
        </Space>
      )
    },
    {
      title: '操作',
      render: (_, record) => {
        if (record.is_selected) {
          if (record.score !== null && record.score !== undefined) {
            return <Button disabled>已出成绩</Button>;
          }
          return (
            <Popconfirm title="确认退选？" onConfirm={() => dropCourse(Number(record.selection_id))}>
              <Button danger icon={<DeleteOutlined />}>退选</Button>
            </Popconfirm>
          );
        }
        if (record.status !== 'open') {
          return <Button disabled>已关闭</Button>;
        }
        if (Number(record.same_course_selected) === 1) {
          return (
            <Tooltip title={record.conflict_reason || '你已选过该课程，不能重复选择不同教师的同一课程'}>
              <span>
                <Button disabled>已选同课</Button>
              </span>
            </Tooltip>
          );
        }
        if (Number(record.time_conflicted) === 1) {
          return (
            <Tooltip title={record.conflict_reason || '该课程与已选课程时间冲突'}>
              <span>
                <Button disabled>时间冲突</Button>
              </span>
            </Tooltip>
          );
        }
        if (Number(record.remaining_capacity || 0) <= 0) {
          return <Button disabled>已满</Button>;
        }
        return (
          <Button type="primary" icon={<SelectOutlined />} onClick={() => selectCourse(record.offering_id)}>
            选课
          </Button>
        );
      }
    }
  ];

  const courseColumns: ColumnsType<AnyRecord> = [
    { title: '学期', dataIndex: 'semester' },
    { title: '课程号', dataIndex: 'course_id' },
    { title: '课程名', dataIndex: 'course_name' },
    { title: '学分', dataIndex: 'credit' },
    { title: '教师号', dataIndex: 'staff_id' },
    { title: '教师', dataIndex: 'teacher_name' },
    { title: '时间', dataIndex: 'class_time' },
    { title: '教室', dataIndex: 'classroom' },
    {
      title: '操作',
      render: (_, record) => {
        if (record.score !== null && record.score !== undefined) {
          return <Button disabled>已出成绩</Button>;
        }
        return (
          <Popconfirm title="确认退选？" onConfirm={() => dropCourse(record.selection_id)}>
            <Button danger icon={<DeleteOutlined />}>退选</Button>
          </Popconfirm>
        );
      }
    }
  ];

  const gradeColumns: ColumnsType<AnyRecord> = [
    { title: '课程号', dataIndex: 'course_id' },
    { title: '课程名', dataIndex: 'course_name' },
    { title: '学分', dataIndex: 'credit' },
    { title: '教师', dataIndex: 'teacher_name' },
    {
      title: '平时成绩',
      dataIndex: 'regular_score',
      render: (score) => (score === null || score === undefined ? '-' : score)
    },
    {
      title: '考试成绩',
      dataIndex: 'exam_score',
      render: (score) => (score === null || score === undefined ? '-' : score)
    },
    {
      title: '总评成绩',
      dataIndex: 'score',
      render: (score) => (score === null || score === undefined ? <Tag>待录入</Tag> : score)
    },
    {
      title: '绩点',
      dataIndex: 'score',
      render: (score) => (score === null || score === undefined ? '-' : scoreToGpa(Number(score)).toFixed(1))
    }
  ];

  const semesterOptions = semesters.map((semester) => ({
    label: semester.semester_name || semester.semester_id,
    value: semester.semester_id
  }));
  const gradeSemesterOptions = [
    ...semesterOptions,
    { label: '全部学期', value: 'all' }
  ];
  const visibleGrades = gradeSemester === 'all'
    ? gradeRows
    : gradeRows.filter((item) => item.semester === gradeSemester);
  const overallGpa = calculateWeightedGpa(gradeRows);
  const semesterGpa = calculateWeightedGpa(visibleGrades);
  const finishedCredits = visibleGrades
    .filter((item) => item.score !== null && item.score !== undefined)
    .reduce((sum, item) => sum + normalizeCredit(item.credit), 0);
  const totalCredits = visibleGrades.reduce((sum, item) => sum + normalizeCredit(item.credit), 0);
  const creditSummaryTitle = gradeSemester === 'all'
    ? '已出成绩学分 / 全部总学分'
    : '已出成绩学分 / 本学期总学分';
  const creditSummary = `${finishedCredits.toFixed(1)} / ${totalCredits.toFixed(1)}`;
  const timetable = useMemo(() => buildTimetable(courseRows), [courseRows]);
  const gpaTrend = useMemo(() => buildGpaTrend(gradeRows), [gradeRows]);

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        {
          key: 'available',
          label: '可选课程',
          children: (
            <div className="page-card">
              <div className="toolbar">
                <Typography.Title level={4}>当前学期课程查询</Typography.Title>
                <Button icon={<ReloadOutlined />} onClick={() => loadAvailable()} />
              </div>
              <Space wrap className="course-filter-bar">
                <Input
                  allowClear
                  placeholder="课程号 / 课程名称 / 教师号 / 教师名称"
                  value={filters.keyword}
                  onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                  onPressEnter={() => loadAvailable()}
                  style={{ width: 320 }}
                />
                <Checkbox
                  checked={filters.hasCapacity}
                  onChange={(event) => setFilters((prev) => ({ ...prev, hasCapacity: event.target.checked }))}
                >
                  有余量
                </Checkbox>
                <Checkbox
                  checked={filters.onlyUnselected}
                  onChange={(event) => setFilters((prev) => ({ ...prev, onlyUnselected: event.target.checked }))}
                >
                  未选
                </Checkbox>
                <Button type="primary" icon={<SearchOutlined />} onClick={() => loadAvailable()}>
                  查询
                </Button>
                <Button onClick={resetFilters}>重置</Button>
              </Space>
              <Table rowKey="offering_id" columns={availableColumns} dataSource={availableRows} scroll={{ x: 1100 }} />
            </div>
          )
        },
        {
          key: 'courses',
          label: '我的课表',
          children: (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div className="page-card">
                <div className="toolbar">
                  <Typography.Title level={4}>当前学期课程表</Typography.Title>
                  <Space wrap>
                    <Select
                      style={{ minWidth: 180 }}
                      value={courseSemester}
                      options={semesterOptions}
                      onChange={changeCourseSemester}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => loadCourses()} />
                  </Space>
                </div>
                <div className="schedule-table-wrap">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>节次</th>
                        {weekdays.map((weekday) => <th key={weekday}>{weekday}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period}>
                          <th>{period}</th>
                          {weekdays.map((weekday) => (
                            <td key={`${period}-${weekday}`}>
                              {(timetable[`${period}-${weekday}`] || []).map((course) => (
                                <div className="schedule-course" key={course.selection_id}>
                                  <strong>{course.course_name}</strong>
                                  <span>{course.teacher_name}</span>
                                  <span>{course.classroom || '-'}</span>
                                </div>
                              ))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="page-card">
                <Typography.Title level={4}>当前学期已选课程</Typography.Title>
                <Table rowKey="selection_id" columns={courseColumns} dataSource={courseRows} scroll={{ x: 1000 }} />
              </div>
            </Space>
          )
        },
        {
          key: 'grades',
          label: '个人成绩',
          forceRender: true,
          children: (
            <div className="page-card">
              <div className="toolbar">
                <Typography.Title level={4}>个人成绩</Typography.Title>
                <Space wrap>
                  <Select
                    style={{ minWidth: 180 }}
                    value={gradeSemester}
                    options={gradeSemesterOptions}
                    onChange={setGradeSemester}
                  />
                  <Button icon={<ReloadOutlined />} onClick={loadGrades} />
                </Space>
              </div>
              <Typography.Title level={5}>近 5 学期平均绩点走势</Typography.Title>
              <GpaTrendChart
                labels={gpaTrend.labels}
                values={gpaTrend.values}
                visible={activeTab === 'grades'}
              />
              <div className="stats-grid">
                <Statistic title="总平均绩点" value={overallGpa ?? 0} precision={2} />
                <Statistic title="当前筛选学期绩点" value={semesterGpa ?? 0} precision={2} />
                <Statistic title={creditSummaryTitle} value={creditSummary} />
              </div>
              <Table rowKey="selection_id" columns={gradeColumns} dataSource={visibleGrades} scroll={{ x: 1000 }} />
            </div>
          )
        }
      ]}
    />
  );
}

function scoreToGpa(score: number) {
  if (score >= 90) return 4.0;
  if (score >= 85) return 3.7;
  if (score >= 82) return 3.3;
  if (score >= 78) return 3.0;
  if (score >= 75) return 2.7;
  if (score >= 72) return 2.3;
  if (score >= 68) return 2.0;
  if (score >= 64) return 1.5;
  if (score >= 60) return 1.0;
  return 0;
}

function calculateWeightedGpa(rows: AnyRecord[]) {
  let totalCredits = 0;
  let weighted = 0;
  for (const row of rows) {
    if (row.score === null || row.score === undefined) continue;
    const credit = Number(row.credit || 0);
    if (!Number.isFinite(credit) || credit <= 0) continue;
    totalCredits += credit;
    weighted += scoreToGpa(Number(row.score)) * credit;
  }
  return totalCredits > 0 ? weighted / totalCredits : null;
}

function normalizeCredit(value: unknown) {
  const credit = Number(value || 0);
  return Number.isFinite(credit) && credit > 0 ? credit : 0;
}

function buildTimetable(rows: AnyRecord[]) {
  const table: Record<string, AnyRecord[]> = {};
  for (const row of rows) {
    const match = String(row.class_time || '').match(/^(星期[一二三四五六日])=?(\d+-\d+)/);
    if (!match) continue;
    for (const period of expandPeriods(match[2])) {
      const key = `${period}-${match[1]}`;
      table[key] = [...(table[key] || []), row];
    }
  }
  return table;
}

function expandPeriods(range: string) {
  const [start, end] = range.split('-').map(Number);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return periods.filter((period) => {
    const [periodStart, periodEnd] = period.split('-').map(Number);
    return periodStart >= start && periodEnd <= end;
  });
}

function getDefaultSemester(rows: AnyRecord[]) {
  const current = rows.find((item) => Number(item.is_current) === 1);
  return String(current?.semester_id || rows[0]?.semester_id || '');
}

function buildGpaTrend(rows: AnyRecord[]) {
  const sortedSemesters = Array.from(new Set(rows.map((item) => item.semester)))
    .filter(Boolean)
    .sort()
    .slice(-5);
  const values = sortedSemesters.map((semester) => {
    const gpa = calculateWeightedGpa(rows.filter((item) => item.semester === semester));
    return gpa === null ? null : Number(gpa.toFixed(2));
  });
  return { labels: sortedSemesters, values };
}
