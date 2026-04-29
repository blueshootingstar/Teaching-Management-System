import { Router } from 'express';
import * as teacher from '../controllers/teacher.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRole('teacher'));

router.get('/my-courses', asyncHandler(teacher.myCourses));
router.get('/course-students/:courseOfferingId', asyncHandler(teacher.courseStudents));
router.put('/grades/:gradeId', asyncHandler(teacher.updateGrade));
router.get('/course-statistics/:courseOfferingId', asyncHandler(teacher.courseStatistics));

export default router;
