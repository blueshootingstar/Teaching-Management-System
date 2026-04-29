import { Router } from 'express';
import * as statistics from '../controllers/statistics.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get('/course/:courseOfferingId', requireRole('admin', 'teacher'), asyncHandler(statistics.courseStatistics));
router.get('/student/:studentId', requireRole('admin'), asyncHandler(statistics.studentStatistics));
router.get('/teacher/:teacherId', requireRole('admin'), asyncHandler(statistics.teacherStatistics));
router.get('/semester/:semesterId', requireRole('admin'), asyncHandler(statistics.semesterStatistics));
router.get('/course-ranking', requireRole('admin'), asyncHandler(statistics.courseRanking));

export default router;
