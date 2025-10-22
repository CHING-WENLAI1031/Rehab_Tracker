const mongoose = require('mongoose');
const AccessControlService = require('../../../main/js/services/AccessControlService');
const User = require('../../../main/js/models/User');
const RehabTask = require('../../../main/js/models/RehabTask');
const Progress = require('../../../main/js/models/Progress');
const Comment = require('../../../main/js/models/Comment');
const Notification = require('../../../main/js/models/Notification');

describe('AccessControlService', () => {
  let accessControlService;
  let patientId, physiotherapistId, doctorId;
  let patient, physiotherapist, doctor;
  let rehabTaskId, progressId, commentId, notificationId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RehabTask.deleteMany({});
    await Progress.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});

    accessControlService = new AccessControlService();

    // Create test users
    patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    physiotherapist = await User.create({
      firstName: 'Test',
      lastName: 'Physiotherapist',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567891',
      assignedPatients: [patient._id]
    });

    doctor = await User.create({
      firstName: 'Test',
      lastName: 'Doctor',
      email: 'doctor@test.com',
      password: 'password123',
      role: 'doctor',
      phoneNumber: '+1234567892'
    });

    patientId = patient._id;
    physiotherapistId = physiotherapist._id;
    doctorId = doctor._id;

    // Create test data
    const rehabTask = await RehabTask.create({
      title: 'Test Exercise',
      description: 'A test exercise',
      assignedTo: patientId,
      assignedBy: physiotherapistId,
      status: 'active',
      scheduleType: 'once',
      scheduledDate: new Date(),
      exercises: [{
        name: 'Push-ups',
        sets: 3,
        reps: 10
      }]
    });
    rehabTaskId = rehabTask._id;

    const progress = await Progress.create({
      userId: patientId,
      rehabTaskId: rehabTaskId,
      sessionDuration: 30,
      completionStatus: 'completed',
      completionPercentage: 100,
      assessments: {
        painBefore: 3,
        painAfter: 1
      }
    });
    progressId = progress._id;

    const comment = await Comment.create({
      author: physiotherapistId,
      targetType: 'rehabTask',
      targetId: rehabTaskId,
      relatedPatient: patientId,
      content: 'Great progress!',
      commentType: 'feedback',
      visibility: 'patient_visible'
    });
    commentId = comment._id;

    const notification = await Notification.create({
      recipient: patientId,
      recipientRole: 'patient',
      title: 'Test Notification',
      message: 'This is a test',
      type: 'task_reminder',
      category: 'reminders'
    });
    notificationId = notification._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('hasPermission', () => {
    describe('RehabTask permissions', () => {
      it('should allow patient to read own tasks', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'rehabTask',
          'read',
          { assignedTo: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should not allow patient to read others tasks', async () => {
        const otherPatient = await User.create({
          firstName: 'Other',
          lastName: 'Patient',
          email: 'other@test.com',
          password: 'password123',
          role: 'patient',
          phoneNumber: '+1234567899'
        });

        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'rehabTask',
          'read',
          { assignedTo: otherPatient._id }
        );
        expect(hasPermission).toBe(false);
      });

      it('should allow physiotherapist to read assigned patient tasks', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'rehabTask',
          'read',
          { assignedBy: physiotherapistId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow doctor to read all tasks', async () => {
        const hasPermission = await accessControlService.hasPermission(
          doctorId,
          'rehabTask',
          'read',
          { assignedTo: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should not allow patient to write tasks', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'rehabTask',
          'write',
          { assignedTo: patientId }
        );
        expect(hasPermission).toBe(false);
      });

      it('should allow physiotherapist to write assigned tasks', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'rehabTask',
          'write',
          { assignedBy: physiotherapistId }
        );
        expect(hasPermission).toBe(true);
      });
    });

    describe('Progress permissions', () => {
      it('should allow patient to read own progress', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'progress',
          'read',
          { userId: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow patient to write own progress', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'progress',
          'write',
          { userId: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow physiotherapist to read assigned patient progress', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'progress',
          'read',
          { userId: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should not allow physiotherapist to write patient progress', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'progress',
          'write',
          { userId: patientId }
        );
        expect(hasPermission).toBe(false);
      });
    });

    describe('Comment permissions', () => {
      it('should allow patient to read visible comments', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'comment',
          'read',
          {
            relatedPatient: patientId,
            visibility: 'patient_visible'
          }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow patient to write in own context', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'comment',
          'write',
          { relatedPatient: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow physiotherapist to read assigned patient comments', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'comment',
          'read',
          { relatedPatient: patientId }
        );
        expect(hasPermission).toBe(true);
      });
    });

    describe('Notification permissions', () => {
      it('should allow user to read own notifications', async () => {
        const hasPermission = await accessControlService.hasPermission(
          patientId,
          'notification',
          'read',
          { recipient: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should not allow user to read others notifications', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'notification',
          'read',
          { recipient: patientId }
        );
        expect(hasPermission).toBe(false);
      });

      it('should allow physiotherapist to create notifications for assigned patients', async () => {
        const hasPermission = await accessControlService.hasPermission(
          physiotherapistId,
          'notification',
          'write',
          { recipient: patientId }
        );
        expect(hasPermission).toBe(true);
      });

      it('should allow doctor to create notifications for all users', async () => {
        const hasPermission = await accessControlService.hasPermission(
          doctorId,
          'notification',
          'write',
          { recipient: patientId }
        );
        expect(hasPermission).toBe(true);
      });
    });
  });

  describe('getFilteredQuery', () => {
    it('should return unfiltered query for doctors', async () => {
      const query = await accessControlService.getFilteredQuery(doctorId, 'rehabTask');
      expect(query).toEqual({});
    });

    it('should filter tasks for patients to show only their own', async () => {
      const query = await accessControlService.getFilteredQuery(patientId, 'rehabTask');
      expect(query).toHaveProperty('assignedTo', patientId);
    });

    it('should filter tasks for physiotherapists to show assigned patients', async () => {
      const query = await accessControlService.getFilteredQuery(physiotherapistId, 'rehabTask');
      expect(query).toHaveProperty('assignedBy', physiotherapistId);
    });

    it('should filter progress for patients to show only their own', async () => {
      const query = await accessControlService.getFilteredQuery(patientId, 'progress');
      expect(query).toHaveProperty('userId', patientId);
    });

    it('should filter progress for physiotherapists to show assigned patients', async () => {
      const query = await accessControlService.getFilteredQuery(physiotherapistId, 'progress');
      expect(query).toHaveProperty('userId', { $in: [patientId] });
    });

    it('should filter notifications for all users to show only their own', async () => {
      const query = await accessControlService.getFilteredQuery(patientId, 'notification');
      expect(query).toHaveProperty('recipient', patientId);
    });

    it('should handle additional filters', async () => {
      const additionalFilters = { status: 'active' };
      const query = await accessControlService.getFilteredQuery(
        patientId,
        'rehabTask',
        additionalFilters
      );
      expect(query).toHaveProperty('assignedTo', patientId);
      expect(query).toHaveProperty('status', 'active');
    });
  });

  describe('getAccessiblePatientIds', () => {
    it('should return own ID for patients', async () => {
      const patientIds = await accessControlService.getAccessiblePatientIds(patientId);
      expect(patientIds).toEqual([patientId]);
    });

    it('should return assigned patients for physiotherapists', async () => {
      const patientIds = await accessControlService.getAccessiblePatientIds(physiotherapistId);
      expect(patientIds).toEqual([patientId]);
    });

    it('should return all patients for doctors', async () => {
      const patientIds = await accessControlService.getAccessiblePatientIds(doctorId);
      expect(patientIds).toContain(patientId);
    });
  });

  describe('getAccessiblePhysiotherapistIds', () => {
    it('should return assigned physiotherapists for patients', async () => {
      const physioIds = await accessControlService.getAccessiblePhysiotherapistIds(patientId);
      expect(physioIds).toContain(physiotherapistId);
    });

    it('should return own ID for physiotherapists', async () => {
      const physioIds = await accessControlService.getAccessiblePhysiotherapistIds(physiotherapistId);
      expect(physioIds).toEqual([physiotherapistId]);
    });

    it('should return all physiotherapists for doctors', async () => {
      const physioIds = await accessControlService.getAccessiblePhysiotherapistIds(doctorId);
      expect(physioIds).toContain(physiotherapistId);
    });
  });

  describe('sanitizeUserData', () => {
    it('should remove sensitive fields for all roles', async () => {
      const sanitized = accessControlService.sanitizeUserData(patient, patient);
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('tokens');
    });

    it('should limit data for patients viewing other users', async () => {
      const sanitized = accessControlService.sanitizeUserData(patient, physiotherapist);
      expect(sanitized).toHaveProperty('firstName');
      expect(sanitized).toHaveProperty('lastName');
      expect(sanitized).toHaveProperty('role');
      expect(Object.keys(sanitized)).toHaveLength(4); // _id, firstName, lastName, role
    });

    it('should allow physiotherapists to see assigned patient details', async () => {
      const sanitized = accessControlService.sanitizeUserData(physiotherapist, patient);
      expect(sanitized).toHaveProperty('firstName');
      expect(sanitized).toHaveProperty('lastName');
      expect(sanitized).toHaveProperty('email');
      expect(sanitized).toHaveProperty('phoneNumber');
    });

    it('should limit physiotherapist view of non-assigned patients', async () => {
      const otherPatient = await User.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567899'
      });

      const sanitized = accessControlService.sanitizeUserData(physiotherapist, otherPatient);
      expect(sanitized).toHaveProperty('firstName');
      expect(sanitized).toHaveProperty('lastName');
      expect(sanitized).toHaveProperty('role');
      expect(Object.keys(sanitized)).toHaveLength(4); // Limited info
    });
  });

  describe('canAccessTask', () => {
    it('should allow patient to access own task', async () => {
      const canAccess = await accessControlService.canAccessTask(patientId, rehabTaskId);
      expect(canAccess).toBe(true);
    });

    it('should allow physiotherapist to access assigned task', async () => {
      const canAccess = await accessControlService.canAccessTask(physiotherapistId, rehabTaskId);
      expect(canAccess).toBe(true);
    });

    it('should allow doctor to access any task', async () => {
      const canAccess = await accessControlService.canAccessTask(doctorId, rehabTaskId);
      expect(canAccess).toBe(true);
    });

    it('should deny access to unrelated users', async () => {
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567899'
      });

      const canAccess = await accessControlService.canAccessTask(otherUser._id, rehabTaskId);
      expect(canAccess).toBe(false);
    });
  });

  describe('canAccessProgress', () => {
    it('should allow patient to access own progress', async () => {
      const canAccess = await accessControlService.canAccessProgress(patientId, progressId);
      expect(canAccess).toBe(true);
    });

    it('should allow physiotherapist to access assigned patient progress', async () => {
      const canAccess = await accessControlService.canAccessProgress(physiotherapistId, progressId);
      expect(canAccess).toBe(true);
    });

    it('should allow doctor to access any progress', async () => {
      const canAccess = await accessControlService.canAccessProgress(doctorId, progressId);
      expect(canAccess).toBe(true);
    });

    it('should deny access to unrelated users', async () => {
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567899'
      });

      const canAccess = await accessControlService.canAccessProgress(otherUser._id, progressId);
      expect(canAccess).toBe(false);
    });
  });

  describe('getFilteredData', () => {
    it('should return paginated filtered data', async () => {
      const result = await accessControlService.getFilteredData(patientId, 'rehabTask', {
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toHaveProperty('totalCount', 1);
      expect(result.pagination).toHaveProperty('totalPages', 1);
    });

    it('should apply role-based filtering', async () => {
      // Create task for different patient
      const otherPatient = await User.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567899'
      });

      await RehabTask.create({
        title: 'Other Exercise',
        description: 'Another test exercise',
        assignedTo: otherPatient._id,
        assignedBy: physiotherapistId,
        status: 'active',
        scheduleType: 'once',
        scheduledDate: new Date(),
        exercises: [{
          name: 'Squats',
          sets: 3,
          reps: 15
        }]
      });

      // Patient should only see their own task
      const patientResult = await accessControlService.getFilteredData(patientId, 'rehabTask');
      expect(patientResult.data).toHaveLength(1);
      expect(patientResult.data[0].assignedTo.toString()).toBe(patientId.toString());

      // Physiotherapist should see both tasks (assigned by them)
      const physioResult = await accessControlService.getFilteredData(physiotherapistId, 'rehabTask');
      expect(physioResult.data).toHaveLength(2);

      // Doctor should see all tasks
      const doctorResult = await accessControlService.getFilteredData(doctorId, 'rehabTask');
      expect(doctorResult.data).toHaveLength(2);
    });

    it('should handle sorting and pagination', async () => {
      // Create additional task
      await RehabTask.create({
        title: 'Second Exercise',
        description: 'Second test exercise',
        assignedTo: patientId,
        assignedBy: physiotherapistId,
        status: 'active',
        scheduleType: 'once',
        scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
        exercises: [{
          name: 'Lunges',
          sets: 2,
          reps: 12
        }]
      });

      const result = await accessControlService.getFilteredData(patientId, 'rehabTask', {
        page: 1,
        limit: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalCount).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should handle invalid resource type', async () => {
      const result = await accessControlService.getFilteredData(patientId, 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid resource type');
    });
  });
});