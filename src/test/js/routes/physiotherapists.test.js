const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../main/js/server');
const User = require('../../../main/js/models/User');
const Comment = require('../../../main/js/models/Comment');
const RehabTask = require('../../../main/js/models/RehabTask');
const Progress = require('../../../main/js/models/Progress');
const jwt = require('jsonwebtoken');

describe('Physiotherapist Routes - New Endpoints', () => {
  let physioToken, physiotherapist, patient, otherPatient;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Comment.deleteMany({});
    await RehabTask.deleteMany({});
    await Progress.deleteMany({});

    // Create test patient
    patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    // Create other patient (not assigned)
    otherPatient = await User.create({
      firstName: 'Other',
      lastName: 'Patient',
      email: 'other@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567899'
    });

    // Create test physiotherapist
    physiotherapist = await User.create({
      firstName: 'Test',
      lastName: 'Physio',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567891',
      assignedPatients: [patient._id]
    });

    // Generate token directly
    physioToken = jwt.sign({ userId: physiotherapist._id, role: 'physiotherapist' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/physiotherapists/patients/:patientId', () => {
    beforeEach(async () => {
      // Create test task
      await RehabTask.create({
        title: 'Morning Exercise',
        description: 'Daily routine',
        assignedTo: patient._id,
        assignedBy: physiotherapist._id,
        status: 'active',
        scheduleType: 'daily',
        exercises: [{
          name: 'Stretching',
          sets: 3,
          reps: 10
        }]
      });

      // Create test progress
      await Progress.create({
        patient: patient._id,
        rehabTask: (await RehabTask.findOne())._id,
        sessionDate: new Date(),
        completionStatus: 'completed',
        assessments: {
          painBefore: 5,
          painAfter: 3,
          mobilityBefore: 6,
          mobilityAfter: 7,
          energyBefore: 5,
          energyAfter: 6
        },
        sessionDuration: 30
      });
    });

    it('should get assigned patient details', async () => {
      const res = await request(app)
        .get(`/api/physiotherapists/patients/${patient._id}`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('patient');
      expect(res.body.data).toHaveProperty('activeTasks');
      expect(res.body.data).toHaveProperty('recentProgress');
      expect(res.body.data).toHaveProperty('analytics');
      expect(res.body.data.patient._id.toString()).toBe(patient._id.toString());
    });

    it('should return 403 for unassigned patient', async () => {
      const res = await request(app)
        .get(`/api/physiotherapists/patients/${otherPatient._id}`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Access denied');
    });

    it('should return 404 for non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/physiotherapists/patients/${fakeId}`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(403); // First checks assignment
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/physiotherapists/patients/${patient._id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/physiotherapists/feedback', () => {
    it('should add feedback for assigned patient', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Great progress this week! Keep up the excellent work.',
        feedbackType: 'encouragement',
        category: 'progress_review',
        priority: 'normal'
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.feedback).toHaveProperty('content');
      expect(res.body.data.feedback.commentType).toBe('feedback');
      expect(res.body.data.feedback.content).toBe(feedbackData.content);
    });

    it('should not allow feedback for unassigned patient', async () => {
      const feedbackData = {
        patientId: otherPatient._id,
        content: 'Feedback for unassigned patient'
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Access denied');
    });

    it('should require patientId and content', async () => {
      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send({
          patientId: patient._id
        });

      expect(res.status).toBe(400);
    });

    it('should default to patient_visible visibility', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Test feedback'
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(201);
      expect(res.body.data.feedback.visibility).toBe('patient_visible');
    });

    it('should include physiotherapist and patient in visibleTo', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Test feedback'
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(201);
      const visibleTo = res.body.data.feedback.visibleTo;
      expect(visibleTo).toHaveLength(2);

      const patientVisible = visibleTo.find(v => v.role === 'patient');
      const physioVisible = visibleTo.find(v => v.role === 'physiotherapist');

      expect(patientVisible).toBeDefined();
      expect(physioVisible).toBeDefined();
    });

    it('should allow custom feedback types', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Need to focus on flexibility',
        feedbackType: 'improvement_needed',
        category: 'technique_correction'
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(201);
      expect(res.body.data.feedback.metadata.feedbackType).toBe('improvement_needed');
    });

    it('should allow marking feedback as requiring response', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Please let me know how you feel about the new exercises',
        requiresResponse: true
      };

      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(res.status).toBe(201);
      expect(res.body.data.feedback.metadata.requiresResponse).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/physiotherapists/feedback')
        .send({
          patientId: patient._id,
          content: 'Test'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('Patient Details - Data Completeness', () => {
    beforeEach(async () => {
      // Create multiple tasks with different statuses
      await RehabTask.create([
        {
          title: 'Active Task 1',
          description: 'Active exercise',
          assignedTo: patient._id,
          assignedBy: physiotherapist._id,
          status: 'active',
          scheduleType: 'daily',
          exercises: [{ name: 'Exercise 1', sets: 3, reps: 10 }]
        },
        {
          title: 'Completed Task',
          description: 'Completed exercise',
          assignedTo: patient._id,
          assignedBy: physiotherapist._id,
          status: 'completed',
          scheduleType: 'once',
          exercises: [{ name: 'Exercise 2', sets: 2, reps: 15 }]
        }
      ]);

      // Create progress records
      const tasks = await RehabTask.find({ assignedTo: patient._id });
      await Progress.create([
        {
          patient: patient._id,
          rehabTask: tasks[0]._id,
          sessionDate: new Date(),
          completionStatus: 'completed',
          assessments: {
            painBefore: 5,
            painAfter: 3,
            mobilityBefore: 6,
            mobilityAfter: 8,
            energyBefore: 5,
            energyAfter: 7
          },
          sessionDuration: 30
        },
        {
          patient: patient._id,
          rehabTask: tasks[1]._id,
          sessionDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          completionStatus: 'completed',
          assessments: {
            painBefore: 6,
            painAfter: 4,
            mobilityBefore: 5,
            mobilityAfter: 7,
            energyBefore: 4,
            energyAfter: 6
          },
          sessionDuration: 25
        }
      ]);
    });

    it('should include comprehensive patient data', async () => {
      const res = await request(app)
        .get(`/api/physiotherapists/patients/${patient._id}`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(200);

      const { patient: patientData, activeTasks, recentTasks, recentProgress, analytics } = res.body.data;

      // Patient data
      expect(patientData).toHaveProperty('firstName');
      expect(patientData).toHaveProperty('lastName');
      expect(patientData).toHaveProperty('email');
      expect(patientData).not.toHaveProperty('password'); // Should be sanitized

      // Tasks
      expect(Array.isArray(activeTasks)).toBe(true);
      expect(Array.isArray(recentTasks)).toBe(true);

      // Progress
      expect(Array.isArray(recentProgress)).toBe(true);

      // Analytics
      expect(typeof analytics).toBe('object');
    });

    it('should limit active tasks to 10', async () => {
      // Create more than 10 active tasks
      const tasks = [];
      for (let i = 0; i < 15; i++) {
        tasks.push({
          title: `Task ${i}`,
          description: `Description ${i}`,
          assignedTo: patient._id,
          assignedBy: physiotherapist._id,
          status: 'active',
          scheduleType: 'daily',
          exercises: [{ name: `Exercise ${i}`, sets: 3, reps: 10 }]
        });
      }
      await RehabTask.create(tasks);

      const res = await request(app)
        .get(`/api/physiotherapists/patients/${patient._id}`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activeTasks.length).toBeLessThanOrEqual(10);
    });
  });
});
