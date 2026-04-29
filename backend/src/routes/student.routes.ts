import { Router } from 'express';
import * as student from '../controllers/student.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRole('student'));

router.get('/semesters', asyncHandler(student.semesters));
router.get('/available-courses', asyncHandler(student.availableCourses));
router.post('/select-course', asyncHandler(student.selectCourse));
router.delete('/drop-course/:selectionId', asyncHandler(student.dropCourse));
router.get('/my-courses', asyncHandler(student.myCourses));
router.get('/timetable', asyncHandler(student.timetable));
router.get('/my-grades', asyncHandler(student.myGrades));

export default router;
