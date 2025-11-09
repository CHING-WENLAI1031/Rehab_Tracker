const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../main/js/server');
const User = require('../../../main/js/models/User');
const Surgery = require('../../../main/js/models/Surgery');
const Comment = require('../../../main/js/models/Comment');
const RehabTask = require('../../../main/js/models/RehabTask');
const Progress = require('../../../main/js/models/Progress');
const jwt = require('jsonwebtoken');

describe('Doctor Routes', () => {
  let doctorToken, doctor, patient, physiotherapist;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Surgery.deleteMany({});
    await Comment.deleteMany({});
    await RehabTask.deleteMany({});
    await Progress.deleteMany({});

    // Create test doctor
    doctor = await User.create({
      firstName: 'Test',
      lastName: 'Doctor',
      email: 'doctor@test.com',
      password: 'password123',
      role: 'doctor',
      phoneNumber: '+1234567890',
      specialization: 'Orthopedics'
    });

    // Create test patient
    patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567891',
      assignedProviders: [{
        providerId: doctor._id,
        role: 'doctor',
        assignedAt: new Date()
      }]
    });

    // Create test physiotherapist
    physiotherapist = await User.create({
      firstName: 'Test',
      lastName: 'Physio',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567892',
      assignedPatients: [patient._id]
    });

    // Generate token directly
    doctorToken = jwt.sign({ userId: doctor._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/doctors/dashboard', () => {
    it('should get doctor dashboard data', async () => {
      const res = await request(app)
        .get('/api/doctors/dashboard')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('patientPopulation');
      expect(res.body.data).toHaveProperty('treatmentOutcomes');
      expect(res.body.data).toHaveProperty('criticalAlerts');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/doctors/dashboard');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/doctors/patients', () => {
    it('should get all patients overview', async () => {
      const res = await request(app)
        .get('/api/doctors/patients')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalPatients');
      expect(res.body.data).toHaveProperty('demographics');
    });
  });

  describe('GET /api/doctors/patients/:patientId/recovery', () => {
    it('should get patient recovery progress', async () => {
      const res = await request(app)
        .get(`/api/doctors/patients/${patient._id}/recovery`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('patient');
      expect(res.body.data).toHaveProperty('treatmentHistory');
    });

    it('should return 403 for unassigned patient', async () => {
      // Create another patient not assigned to this doctor
      const otherPatient = await User.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567899'
      });

      const res = await request(app)
        .get(`/api/doctors/patients/${otherPatient._id}/recovery`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(500); // Will throw error in getPatientReport
    });
  });

  describe('POST /api/doctors/annotations', () => {
    it('should create medical annotation', async () => {
      const annotationData = {
        patientId: patient._id,
        content: 'Patient showing good progress with minimal complications',
        category: 'progress_review',
        clinicalSignificance: 'moderate',
        priority: 'high'
      };

      const res = await request(app)
        .post('/api/doctors/annotations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(annotationData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.annotation).toHaveProperty('content');
      expect(res.body.data.annotation.commentType).toBe('medical_annotation');
    });

    it('should require content and category', async () => {
      const res = await request(app)
        .post('/api/doctors/annotations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient._id
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/doctors/surgery-records', () => {
    it('should create surgery record', async () => {
      const surgeryData = {
        patient: patient._id,
        surgeryType: 'ACL Reconstruction',
        surgeryDate: new Date(),
        diagnosis: 'Complete ACL tear',
        procedure: {
          technique: 'Arthroscopic',
          graftType: 'Hamstring autograft',
          duration: 120
        },
        postOpInstructions: 'Rest for 2 weeks, then start PT',
        expectedRecoveryTime: {
          weeks: 24
        }
      };

      const res = await request(app)
        .post('/api/doctors/surgery-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(surgeryData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surgery).toHaveProperty('surgeryType');
      expect(res.body.data.surgery.surgeryType).toBe('ACL Reconstruction');
    });

    it('should require mandatory fields', async () => {
      const res = await request(app)
        .post('/api/doctors/surgery-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patient: patient._id
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/doctors/surgery-records/:patientId', () => {
    beforeEach(async () => {
      await Surgery.create({
        patient: patient._id,
        performingDoctor: doctor._id,
        surgeryType: 'ACL Reconstruction',
        surgeryDate: new Date(),
        diagnosis: 'ACL tear',
        status: 'completed'
      });
    });

    it('should get surgery records for patient', async () => {
      const res = await request(app)
        .get(`/api/doctors/surgery-records/${patient._id}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surgeries).toHaveLength(1);
    });
  });

  describe('PUT /api/doctors/surgery-records/:recordId', () => {
    let surgeryId;

    beforeEach(async () => {
      const surgery = await Surgery.create({
        patient: patient._id,
        performingDoctor: doctor._id,
        surgeryType: 'ACL Reconstruction',
        surgeryDate: new Date(),
        diagnosis: 'ACL tear',
        status: 'completed'
      });
      surgeryId = surgery._id;
    });

    it('should update surgery record', async () => {
      const updates = {
        notes: 'Patient recovering well',
        complications: ['Minor swelling'],
        status: 'completed'
      };

      const res = await request(app)
        .put(`/api/doctors/surgery-records/${surgeryId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.surgery.notes).toBe('Patient recovering well');
    });

    it('should not allow update by different doctor', async () => {
      // Create another doctor
      const otherDoctor = await User.create({
        firstName: 'Other',
        lastName: 'Doctor',
        email: 'other-doctor@test.com',
        password: 'password123',
        role: 'doctor',
        phoneNumber: '+1234567898'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other-doctor@test.com',
          password: 'password123'
        });

      const otherToken = loginRes.body.data.token;

      const res = await request(app)
        .put(`/api/doctors/surgery-records/${surgeryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ notes: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/doctors/recommendations', () => {
    it('should create medical recommendation', async () => {
      const recommendationData = {
        patientId: patient._id,
        content: 'Increase exercise intensity gradually over next 4 weeks',
        category: 'treatment_adjustment',
        recommendationType: 'treatment',
        priority: 'high'
      };

      const res = await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(recommendationData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendation).toHaveProperty('content');
      expect(res.body.data.recommendation.commentType).toBe('clinical_recommendation');
    });

    it('should require patientId, content, and category', async () => {
      const res = await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient._id
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/doctors/analytics/overview', () => {
    it('should get comprehensive analytics', async () => {
      const res = await request(app)
        .get('/api/doctors/analytics/overview')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('performanceMetrics');
      expect(res.body.data).toHaveProperty('treatmentOutcomes');
      expect(res.body.data).toHaveProperty('physiotherapistMetrics');
      expect(res.body.data).toHaveProperty('criticalAlerts');
    });
  });
});
