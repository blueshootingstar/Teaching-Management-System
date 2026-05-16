import { Router } from 'express';
import * as teacher from '../controllers/teacher.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRole('teacher'));

router.get('/semesters', asyncHandler(teacher.semesters));
router.get('/my-courses', asyncHandler(teacher.myCourses));
router.get('/timetable', asyncHandler(teacher.timetable));
router.get('/substitute-candidates', asyncHandler(teacher.substituteCandidates));
router.post('/substitution-requests', asyncHandler(teacher.createSubstitutionRequest));
router.post('/substitution-requests/:id/accept', asyncHandler(teacher.acceptSubstitutionRequest));
router.post('/substitution-requests/:id/reject', asyncHandler(teacher.rejectSubstitutionRequest));
router.get('/course-students/:courseOfferingId', asyncHandler(teacher.courseStudents));
router.put('/grades/:gradeId', asyncHandler(teacher.updateGrade));
router.get('/course-statistics/:courseOfferingId', asyncHandler(teacher.courseStatistics));

export default router;
