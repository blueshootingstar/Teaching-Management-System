import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/departments', asyncHandler(admin.listDepartments));
router.get('/student-statuses', asyncHandler(admin.listStudentStatuses));
router.get('/professional-ranks', asyncHandler(admin.listProfessionalRanks));
router.get('/course-hour-options', asyncHandler(admin.listCourseHourOptions));
router.get('/classrooms', asyncHandler(admin.listClassrooms));
router.get('/course-selection-window', asyncHandler(admin.getCourseSelectionWindow));
router.put('/course-selection-window', asyncHandler(admin.updateCourseSelectionWindow));
router.get('/system-settings', asyncHandler(admin.getSystemSettings));
router.put('/system-settings/:key', asyncHandler(admin.updateSystemSetting));
router.get('/notifications', asyncHandler(admin.listNotifications));
router.post('/notifications', asyncHandler(admin.sendNotification));
router.delete('/notifications/:mailItemId', asyncHandler(admin.deleteNotification));

router.get('/students', asyncHandler(admin.listStudents));
router.post('/students', asyncHandler(admin.createStudent));
router.put('/students/:id', asyncHandler(admin.updateStudent));
router.delete('/students/:id', asyncHandler(admin.deleteStudent));

router.get('/teachers', asyncHandler(admin.listTeachers));
router.post('/teachers', asyncHandler(admin.createTeacher));
router.put('/teachers/:id', asyncHandler(admin.updateTeacher));
router.delete('/teachers/:id', asyncHandler(admin.deleteTeacher));

router.get('/courses', asyncHandler(admin.listCourses));
router.post('/courses', asyncHandler(admin.createCourse));
router.put('/courses/:id', asyncHandler(admin.updateCourse));
router.delete('/courses/:id', asyncHandler(admin.deleteCourse));

router.get('/semesters', asyncHandler(admin.listSemesters));
router.post('/semesters', asyncHandler(admin.createSemester));
router.put('/semesters/:id', asyncHandler(admin.updateSemester));
router.put('/semesters/:id/current', asyncHandler(admin.setCurrentSemester));
router.delete('/semesters/:id', asyncHandler(admin.deleteSemester));

router.get('/course-offerings', asyncHandler(admin.listCourseOfferings));
router.post('/course-offerings', asyncHandler(admin.createCourseOffering));
router.put('/course-offerings/:id', asyncHandler(admin.updateCourseOffering));
router.delete('/course-offerings/:id', asyncHandler(admin.deleteCourseOffering));

export default router;
