import { BarChartOutlined, EditOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Modal, Progress, Space, Statistic, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import request from '../../api/request';
import type { AnyRecord } from '../../types';

function matchRecordKeyword(record: AnyRecord, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return Object.values(record)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(' ')
    .includes(normalizedKeyword);
}

export default function TeacherDashboard() {
  const [courseRows, setCourseRows] = useState<AnyRecord[]>([]);
  const [studentRows, setStudentRows] = useState<AnyRecord[]>([]);
  const [courseKeyword, setCourseKeyword] = useState('');
  const [studentKeyword, setStudentKeyword] = useState('');
  const [stats, setStats] = useState<AnyRecord | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<AnyRecord | null>(null);
  const [gradeRecord, setGradeRecord] = useState<AnyRecord | null>(null);
  const [detailMode, setDetailMode] = useState<'students' | 'statistics' | null>(null);
  const [gradeForm] = Form.useForm();
  const regularScore = Form.useWatch('regular_score', gradeForm);
  const examScore = Form.useWatch('exam_score', gradeForm);

  const loadCourses = async () => {
    const data = await request.get<AnyRecord[]>('/teacher/my-courses');
    setCourseRows(data);
  };

  useEffect(() => {
    loadCourses();
  }, []);

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

  const saveGrade = async () => {
    const values = await gradeForm.validateFields();
    if (!gradeRecord) return;
    await request.put(`/teacher/grades/${gradeRecord.grade_id}`, values);
    message.success('成绩已保存');
    setGradeRecord(null);
    if (selectedCourse) {
      await loadStudents(selectedCourse);
    }
  };

  const courseColumns: ColumnsType<AnyRecord> = [
    { title: '学期', dataIndex: 'semester' },
    { title: '课程号', dataIndex: 'course_id' },
    { title: '课程名', dataIndex: 'course_name' },
    { title: '时间', dataIndex: 'class_time' },
    { title: '教室', dataIndex: 'classroom' },
    { title: '人数', dataIndex: 'selected_count' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => loadStudents(record)}>名单</Button>
          <Button icon={<BarChartOutlined />} onClick={() => loadStats(record)}>统计</Button>
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
        <Button
          icon={<EditOutlined />}
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
  const filteredCourseRows = useMemo(
    () => courseRows.filter((record) => matchRecordKeyword(record, courseKeyword)),
    [courseKeyword, courseRows]
  );
  const filteredStudentRows = useMemo(
    () => studentRows.filter((record) => matchRecordKeyword(record, studentKeyword)),
    [studentKeyword, studentRows]
  );

  return (
    <>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="page-card">
          <div className="toolbar">
            <Typography.Title level={4}>我的授课课程</Typography.Title>
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="搜索学期 / 课程 / 时间 / 教室"
                value={courseKeyword}
                onChange={(event) => setCourseKeyword(event.target.value)}
                style={{ width: 300 }}
              />
              <Button onClick={() => setCourseKeyword('')}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={loadCourses} />
            </Space>
          </div>
          <Table rowKey="offering_id" columns={courseColumns} dataSource={filteredCourseRows} scroll={{ x: 900 }} />
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
            <Table rowKey="selection_id" columns={studentColumns} dataSource={filteredStudentRows} scroll={{ x: 1000 }} />
          </div>
        )}

        {detailMode === 'statistics' && (
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
        )}
      </Space>
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
    </>
  );
}
