import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import studentRoutes from './routes/student.routes';
import teacherRoutes from './routes/teacher.routes';
import statisticsRoutes from './routes/statistics.routes';
import { fail } from './utils/response';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ code: 200, message: 'success', data: { status: 'ok' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use((_req, res) => fail(res, '接口不存在', 404));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : '服务器内部错误';
  console.error(error);
  return fail(res, message, 500);
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
