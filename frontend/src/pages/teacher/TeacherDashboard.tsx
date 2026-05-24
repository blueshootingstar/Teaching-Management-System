import {
  BarChartOutlined,
  EditOutlined,
  SwapOutlined,
  TeamOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
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

const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const periods = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'];
const weekOptions = Array.from({ length: 16 }, (_, index) => ({
  label: `第 ${index + 1} 周`,
  value: index + 1
}));

function matchRecordKeyword(record: AnyRecord, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return Object.values(record)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(' ')
    .includes(normalizedKeyword);
}

function normalizeCandidateResponse(data: AnyRecord[] | AnyRecord) {
  if (Array.isArray(data)) {
    return {
      candidates: data,
      requestState: {
        request_blocked: false,
        request_block_reason: null,
        active_request: null
      }
    };
  }
  return {
    candidates: data.candidates || [],
    requestState: {
      request_blocked: !!data.request_blocked,
      request_block_reason: data.request_block_reason || null,
      active_request: data.active_request || null
    }
  };
}

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [semesters, setSemesters] = useState<AnyRecord[]>([]);
  const [currentSemesterId, setCurrentSemesterId] = useState<string>();
  const [courseSemester, setCourseSemester] = useState<string>();
  const [scheduleSemester, setScheduleSemester] = useState<string>();
  const [scheduleWeek, setScheduleWeek] = useState(1);
  const [courseRows, setCourseRows] = useState<AnyRecord[]>([]);
  const [timetableRows, setTimetableRows] = useState<AnyRecord[]>([]);
  const [studentRows, setStudentRows] = useState<AnyRecord[]>([]);
  const [candidateRows, setCandidateRows] = useState<AnyRecord[]>([]);
  const [substitutionRequestState, setSubstitutionRequestState] = useState<AnyRecord | null>(null);
  const [sendingSubstituteStaffId, setSendingSubstituteStaffId] = useState<string | null>(null);
  const [courseKeyword, setCourseKeyword] = useState('');
  const [studentKeyword, setStudentKeyword] = useState('');
  const [stats, setStats] = useState<AnyRecord | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<AnyRecord | null>(null);
  const [substitutionCourse, setSubstitutionCourse] = useState<AnyRecord | null>(null);
  const [gradeRecord, setGradeRecord] = useState<AnyRecord | null>(null);
  const [gradeUploadOpen, setGradeUploadOpen] = useState<boolean | null>(null);
  const [detailMode, setDetailMode] = useState<'students' | 'statistics' | null>(null);
  const [gradeForm] = Form.useForm();
  const [substitutionForm] = Form.useForm();
  const regularScore = Form.useWatch('regular_score', gradeForm);
  const examScore = Form.useWatch('exam_score', gradeForm);
  const substituteWeek = Form.useWatch('week_no', substitutionForm);

  const loadSemesters = async () => {
    const data = await request.get<AnyRecord[]>('/teacher/semesters');
    setSemesters(data);
    const current = getDefaultSemester(data);
    setCurrentSemesterId(current);
    setCourseSemester((prev) => prev || current);
    setScheduleSemester((prev) => prev || current);
    return current;
  };

  const loadCourses = async (semester = courseSemester || currentSemesterId) => {
    const data = await request.get<AnyRecord[]>('/teacher/my-courses', { params: { semester } });
    setCourseRows(data);
  };

  const loadTimetable = async (semester = scheduleSemester || currentSemesterId, week = scheduleWeek) => {
    const data = await request.get<AnyRecord[]>('/teacher/timetable', {
      params: { semester, week }
    });
    setTimetableRows(data);
  };

  const loadGradeUploadWindow = async () => {
    const data = await request.get<AnyRecord>('/teacher/grade-upload-window');
    setGradeUploadOpen(Boolean(data.is_open));
  };

  const reloadAll = async () => {
    const current = await loadSemesters();
    await Promise.all([
      loadCourses(courseSemester || current),
      loadTimetable(scheduleSemester || current, scheduleWeek),
      loadGradeUploadWindow()
    ]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  useEffect(() => {
    const reloadAfterSubstitution = () => {
      loadTimetable(scheduleSemester || currentSemesterId, scheduleWeek);
      loadCourses(courseSemester || currentSemesterId);
    };
    window.addEventListener('substitution-updated', reloadAfterSubstitution);
    return () => window.removeEventListener('substitution-updated', reloadAfterSubstitution);
  }, [courseSemester, currentSemesterId, scheduleSemester, scheduleWeek]);

  const changeCourseSemester = async (semester: string) => {
    setCourseSemester(semester);
    setDetailMode(null);
    await loadCourses(semester);
  };

  const changeScheduleSemester = async (semester: string) => {
    setScheduleSemester(semester);
    await loadTimetable(semester, scheduleWeek);
  };

  const changeScheduleWeek = async (week: number) => {
    setScheduleWeek(week);
    await loadTimetable(scheduleSemester || currentSemesterId, week);
  };

  const loadStudents = async (record: AnyRecord) => {
    if (selectedCourse?.offering_id !== record.offering_id) {
      setStudentKeyword('');
    }
    setSelectedCourse(record);
    const data = await request.get<AnyRecord[]>(`/teacher/course-students/${record.offering_id}`);
    setStudentRows(data);
    setStats(null);
    setDetailMode('students');
  };

  const loadStats = async (record: AnyRecord) => {
    setSelectedCourse(record);
    const [statData, rosterData] = await Promise.all([
      request.get<AnyRecord[]>(`/teacher/course-statistics/${record.offering_id}`),
      request.get<AnyRecord[]>(`/teacher/course-students/${record.offering_id}`)
    ]);
    setStats(statData[0] || null);
    setStudentRows(rosterData);
    setDetailMode('statistics');
  };

  const openSubstitution = async (record: AnyRecord) => {
    const defaultWeek = Math.min(scheduleWeek, Number(record.required_weeks || 16));
    setSubstitutionCourse(record);
    setSubstitutionRequestState(null);
    substitutionForm.setFieldsValue({ week_no: defaultWeek, reason: '' });
    const data = await request.get<AnyRecord[] | AnyRecord>('/teacher/substitute-candidates', {
      params: { offeringId: record.offering_id, week: defaultWeek }
    });
    const normalized = normalizeCandidateResponse(data);
    setCandidateRows(normalized.candidates);
    setSubstitutionRequestState(normalized.requestState);
  };

  const reloadCandidates = async (nextWeek?: number) => {
    if (!substitutionCourse) return;
    const week = Number(nextWeek || substituteWeek || 1);
    const data = await request.get<AnyRecord[] | AnyRecord>('/teacher/substitute-candidates', {
      params: { offeringId: substitutionCourse.offering_id, week }
    });
    const normalized = normalizeCandidateResponse(data);
    setCandidateRows(normalized.candidates);
    setSubstitutionRequestState(normalized.requestState);
  };

  const sendSubstitutionRequest = async (candidate: AnyRecord) => {
    const values = await substitutionForm.validateFields();
    if (!substitutionCourse) return;
    if (substitutionRequestState?.request_blocked) {
      message.warning(substitutionRequestState.request_block_reason || '该周课程已有代课申请，不能重复发送');
      return;
    }
    setSendingSubstituteStaffId(candidate.staff_id);
    try {
      await request.post('/teacher/substitution-requests', {
        offeringId: substitutionCourse.offering_id,
        weekNo: values.week_no,
        substituteStaffId: candidate.staff_id,
        reason: values.reason
      });
      message.success('代课申请已发送');
      setSubstitutionCourse(null);
      setCandidateRows([]);
      setSubstitutionRequestState(null);
      await Promise.all([
        loadTimetable(scheduleSemester || currentSemesterId, scheduleWeek),
        loadCourses(courseSemester || currentSemesterId)
      ]);
    } finally {
      setSendingSubstituteStaffId(null);
    }
  };

  const saveGrade = async () => {
    const values = await gradeForm.validateFields();
    if (!gradeRecord) return;
    if (!gradeUploadOpen) {
      message.warning('管理员尚未开放成绩上传');
      return;
    }
    try {
      await request.put(`/teacher/grades/${gradeRecord.grade_id}`, values);
      message.success('成绩已保存');
      setGradeRecord(null);
      if (selectedCourse) {
        await loadStudents(selectedCourse);
      }
    } catch (error: any) {
      const status = error?.response?.status || error?.response?.data?.code;
      if (status === 403) setGradeUploadOpen(false);
      throw error;
    }
  };

  const filteredCourseRows = useMemo(
    () => courseRows.filter((record) => matchRecordKeyword(record, courseKeyword)),
    [courseKeyword, courseRows]
  );
  const filteredStudentRows = useMemo(
    () => studentRows.filter((record) => matchRecordKeyword(record, studentKeyword)),
    [studentKeyword, studentRows]
  );
  const timetable = useMemo(() => buildTimetable(timetableRows), [timetableRows]);
  const semesterOptions = semesters.map((semester) => ({
    label: semester.semester_name || semester.semester_id,
    value: semester.semester_id
  }));

  const courseColumns: ColumnsType<AnyRecord> = [
    { title: '学期', dataIndex: 'semester' },
    { title: '课程号', dataIndex: 'course_id' },
    { title: '课程名', dataIndex: 'course_name' },
    { title: '学时/周数', dataIndex: 'credit_hours', render: (_, record) => `${record.credit_hours} / ${record.required_weeks}周` },
    { title: '时间', dataIndex: 'class_time' },
    { title: '教室', dataIndex: 'classroom' },
    { title: '人数', dataIndex: 'selected_count' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => loadStudents(record)}>名单</Button>
          <Button icon={<BarChartOutlined />} onClick={() => loadStats(record)}>统计</Button>
          <Button icon={<SwapOutlined />} onClick={() => openSubstitution(record)}>申请代课</Button>
        </Space>
      )
    }
  ];

  const studentColumns: ColumnsType<AnyRecord> = [
    { title: '学号', dataIndex: 'student_id' },
    { title: '姓名', dataIndex: 'student_name' },
    { title: '电话', dataIndex: 'mobile_phone' },
    {
      title: '平时成绩',
      dataIndex: 'regular_score',
      render: (score) => (score === null || score === undefined ? '待录入' : score)
    },
    {
      title: '考试成绩',
      dataIndex: 'exam_score',
      render: (score) => (score === null || score === undefined ? '待录入' : score)
    },
    {
      title: '总评成绩',
      dataIndex: 'score',
      render: (score) => (score === null || score === undefined ? '待录入' : score)
    },
    { title: '状态', dataIndex: 'grade_status' },
    {
      title: '操作',
      render: (_, record) => (
        <Tooltip title={gradeUploadOpen ? undefined : '管理员尚未开放成绩上传'}>
          <span>
            <Button
              icon={<EditOutlined />}
              disabled={!gradeUploadOpen}
              onClick={() => {
                setGradeRecord(record);
                gradeForm.setFieldsValue({
                  regular_score: record.regular_score ?? record.score,
                  exam_score: record.exam_score ?? record.score
                });
              }}
            >
              录入
            </Button>
          </span>
        </Tooltip>
      )
    }
  ];

  const scoredRows = studentRows.filter((item) => item.score !== null && item.score !== undefined);
  const distribution = [
    { label: '90-100', count: scoredRows.filter((item) => Number(item.score) >= 90).length },
    { label: '80-89', count: scoredRows.filter((item) => Number(item.score) >= 80 && Number(item.score) < 90).length },
    { label: '70-79', count: scoredRows.filter((item) => Number(item.score) >= 70 && Number(item.score) < 80).length },
    { label: '60-69', count: scoredRows.filter((item) => Number(item.score) >= 60 && Number(item.score) < 70).length },
    { label: '<60', count: scoredRows.filter((item) => Number(item.score) < 60).length }
  ];
  const maxBucket = Math.max(...distribution.map((item) => item.count), 1);
  const selectedCount = Number(stats?.selected_count || 0);
  const passRate = selectedCount > 0 ? Math.round((Number(stats?.pass_count || 0) / selectedCount) * 100) : 0;
  const excellentRate = selectedCount > 0 ? Math.round((Number(stats?.excellent_count || 0) / selectedCount) * 100) : 0;
  const failRate = selectedCount > 0 ? Math.round((Number(stats?.fail_count || 0) / selectedCount) * 100) : 0;
  const previewFinalScore =
    Number.isFinite(Number(regularScore)) && Number.isFinite(Number(examScore))
      ? (Number(regularScore) * 0.4 + Number(examScore) * 0.6).toFixed(2)
      : '-';
  const substitutionWeekOptions = weekOptions.filter((option) => (
    !substitutionCourse?.required_weeks || option.value <= Number(substitutionCourse.required_weeks)
  ));
  const substitutionBlocked = !!substitutionRequestState?.request_blocked;
  const substitutionBlockReason = substitutionRequestState?.request_block_reason || '该周课程已有代课申请，不能重复发送';

  return (
    <>
      <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'schedule',
              label: '上课表',
              children: (
                <div className="page-card">
                <div className="toolbar">
                  <Typography.Title level={4}>周上课表</Typography.Title>
                  <Space wrap>
                    <Select
                      style={{ minWidth: 180 }}
                      value={scheduleSemester}
                      options={semesterOptions}
                      onChange={changeScheduleSemester}
                    />
                    <Select
                      style={{ width: 120 }}
                      value={scheduleWeek}
                      options={weekOptions}
                      onChange={changeScheduleWeek}
                    />
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
                                <div className="schedule-course" key={`${course.offering_id}-${course.timetable_role}`}>
                                  <strong>{course.course_name}</strong>
                                  <span>{course.classroom || '-'}</span>
                                  {course.timetable_role === 'substitute' ? (
                                    <Tag color="orange">代 {course.original_teacher_name} 上课</Tag>
                                  ) : Number(course.is_substituted) === 1 ? (
                                    <Tag color="blue">由 {course.substitute_teacher_name} 代课</Tag>
                                  ) : (
                                    <span>{course.actual_teacher_name}</span>
                                  )}
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
              )
            },
            {
              key: 'courses',
              label: '授课课程',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div className="page-card">
                  <div className="toolbar">
                    <Typography.Title level={4}>我的授课课程</Typography.Title>
                    <Space wrap>
                      <Select
                        style={{ minWidth: 180 }}
                        value={courseSemester}
                        options={semesterOptions}
                        onChange={changeCourseSemester}
                      />
                      <Input.Search
                        allowClear
                        placeholder="搜索课程 / 时间 / 教室"
                        value={courseKeyword}
                        onChange={(event) => setCourseKeyword(event.target.value)}
                        style={{ width: 260 }}
                      />
                      <Button onClick={() => setCourseKeyword('')}>重置</Button>
                    </Space>
                  </div>
                  <Table rowKey="offering_id" columns={courseColumns} dataSource={filteredCourseRows} scroll={{ x: 1000 }} />
                </div>

                {detailMode === 'students' && (
                  <div className="page-card">
                    <div className="toolbar">
                      <Typography.Title level={4}>
                        {selectedCourse ? `${selectedCourse.course_name} 学生名单` : '学生名单'}
                      </Typography.Title>
                      <Space wrap>
                        <Input.Search
                          allowClear
                          placeholder="搜索学号 / 姓名 / 电话 / 成绩"
                          value={studentKeyword}
                          onChange={(event) => setStudentKeyword(event.target.value)}
                          style={{ width: 300 }}
                        />
                        <Button onClick={() => setStudentKeyword('')}>重置</Button>
                      </Space>
                    </div>
                    {gradeUploadOpen === false && (
                      <Alert type="warning" showIcon message="管理员尚未开放成绩上传，当前只能查看名单和已有成绩。" />
                    )}
                    <Table rowKey="selection_id" columns={studentColumns} dataSource={filteredStudentRows} scroll={{ x: 1000 }} />
                  </div>
                )}

                {detailMode === 'statistics' && (
                  <StatisticsDetail
                    selectedCourse={selectedCourse}
                    stats={stats}
                    distribution={distribution}
                    maxBucket={maxBucket}
                    passRate={passRate}
                    excellentRate={excellentRate}
                    failRate={failRate}
                  />
                )}
                </Space>
              )
            }
          ]}
      />
      <Modal title="录入/修改成绩" open={!!gradeRecord} onOk={saveGrade} onCancel={() => setGradeRecord(null)}>
        <Form form={gradeForm} layout="vertical">
          <Form.Item name="regular_score" label="平时成绩" rules={[{ required: true, message: '请输入平时成绩' }]}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exam_score" label="考试成绩" rules={[{ required: true, message: '请输入考试成绩' }]}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Typography.Text type="secondary">总评成绩 = 平时成绩 40% + 考试成绩 60%，当前预览：{previewFinalScore}</Typography.Text>
        </Form>
      </Modal>
      <Modal
        title={substitutionCourse ? `申请代课：${substitutionCourse.course_name}` : '申请代课'}
        open={!!substitutionCourse}
        footer={null}
        onCancel={() => {
          setSubstitutionCourse(null);
          setCandidateRows([]);
          setSubstitutionRequestState(null);
        }}
        width={760}
        destroyOnClose
      >
        <Form form={substitutionForm} layout="vertical" initialValues={{ week_no: scheduleWeek }}>
          <Form.Item name="week_no" label="教学周" rules={[{ required: true, message: '请选择教学周' }]}>
            <Select options={substitutionWeekOptions} onChange={(week) => reloadCandidates(week)} />
          </Form.Item>
          <Form.Item name="reason" label="申请原因">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
        </Form>
        {substitutionBlocked && (
          <Alert
            type="warning"
            showIcon
            message={substitutionBlockReason}
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          rowKey="staff_id"
          columns={[
            { title: '教工号', dataIndex: 'staff_id' },
            { title: '姓名', dataIndex: 'name' },
            { title: '职称', dataIndex: 'professional_ranks' },
            { title: '院系', dataIndex: 'dept_name' },
            {
              title: '状态',
              render: (_, record) => substitutionBlocked
                ? <Tag color="orange">本周已有申请</Tag>
                : Number(record.available) === 1
                ? <Tag color="green">可代课</Tag>
                : <Tag color="red">{record.conflict_reason || '不可代课'}</Tag>
            },
            {
              title: '操作',
              render: (_, record) => !substitutionBlocked && Number(record.available) === 1 ? (
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  loading={sendingSubstituteStaffId === record.staff_id}
                  disabled={!!sendingSubstituteStaffId}
                  onClick={() => sendSubstitutionRequest(record)}
                >
                  发送申请
                </Button>
              ) : (
                <Tooltip title={substitutionBlocked ? substitutionBlockReason : record.conflict_reason || '该教师不可用'}>
                  <span>
                    <Button disabled>不可发送</Button>
                  </span>
                </Tooltip>
              )
            }
          ]}
          dataSource={candidateRows}
          scroll={{ x: 760 }}
        />
      </Modal>
    </>
  );
}

function StatisticsDetail({
  selectedCourse,
  stats,
  distribution,
  maxBucket,
  passRate,
  excellentRate,
  failRate
}: {
  selectedCourse: AnyRecord | null;
  stats: AnyRecord | null;
  distribution: { label: string; count: number }[];
  maxBucket: number;
  passRate: number;
  excellentRate: number;
  failRate: number;
}) {
  return (
    <div className="page-card">
      <Typography.Title level={4}>
        {selectedCourse ? `${selectedCourse.course_name} 成绩统计` : '课程成绩统计'}
      </Typography.Title>
      {stats ? (
        <>
          <div className="stats-grid">
            <Statistic title="选课人数" value={stats.selected_count || 0} />
            <Statistic title="已录成绩" value={stats.graded_count || 0} />
            <Statistic title="平均分" value={stats.average_score || 0} precision={2} />
            <Statistic title="最高分" value={stats.max_score || 0} />
            <Statistic title="最低分" value={stats.min_score || 0} />
            <Statistic title="优秀人数" value={stats.excellent_count || 0} />
          </div>
          <div className="teacher-chart-grid">
            <div>
              <Typography.Title level={5}>成绩比例</Typography.Title>
              <Space size="large" wrap>
                <Progress type="circle" percent={passRate} format={(value) => `及格 ${value}%`} />
                <Progress type="circle" percent={excellentRate} format={(value) => `优秀 ${value}%`} />
                <Progress type="circle" percent={failRate} status="exception" format={(value) => `不及格 ${value}%`} />
              </Space>
            </div>
            <div>
              <Typography.Title level={5}>分数段分布</Typography.Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                {distribution.map((item) => (
                  <div className="score-bar-row" key={item.label}>
                    <span className="score-bar-label">{item.label}</span>
                    <div className="score-bar-track">
                      <div className="score-bar-fill" style={{ width: `${(item.count / maxBucket) * 100}%` }} />
                    </div>
                    <span className="score-bar-count">{item.count}人</span>
                  </div>
                ))}
              </Space>
            </div>
          </div>
        </>
      ) : (
        <Typography.Text type="secondary">请在授课课程中选择统计。</Typography.Text>
      )}
    </div>
  );
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
