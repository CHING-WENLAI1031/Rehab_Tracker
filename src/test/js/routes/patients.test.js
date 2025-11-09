const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../main/js/server');
const User = require('../../../main/js/models/User');
const Comment = require('../../../main/js/models/Comment');
const jwt = require('jsonwebtoken');

describe('Patient Routes - Notes Endpoints', () => {
  let patientToken, patient;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Comment.deleteMany({});

    // Create test patient
    patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    // Generate token directly
    patientToken = jwt.sign({ userId: patient._id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/patients/notes', () => {
    it('should create a personal note', async () => {
      const noteData = {
        content: 'Feeling much better today. Pain level reduced significantly.',
        mood: 'positive',
        category: 'daily_reflection',
        tags: ['pain', 'improvement']
      };

      const res = await request(app)
        .post('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(noteData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.note).toHaveProperty('content');
      expect(res.body.data.note.commentType).toBe('patient_note');
      expect(res.body.data.note.content).toBe(noteData.content);
    });

    it('should require content field', async () => {
      const res = await request(app)
        .post('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          mood: 'positive'
        });

      expect(res.status).toBe(400);
    });

    it('should default to patient_only visibility', async () => {
      const noteData = {
        content: 'Private reflection'
      };

      const res = await request(app)
        .post('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(noteData);

      expect(res.status).toBe(201);
      expect(res.body.data.note.visibility).toBe('patient_only');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/patients/notes')
        .send({ content: 'Test note' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/patients/notes', () => {
    beforeEach(async () => {
      // Create test notes
      await Comment.create([
        {
          author: patient._id,
          content: 'Note 1',
          commentType: 'patient_note',
          targetType: 'patient',
          targetId: patient._id,
          relatedPatient: patient._id,
          visibility: 'patient_only',
          metadata: { category: 'general', mood: 'neutral' }
        },
        {
          author: patient._id,
          content: 'Note 2',
          commentType: 'patient_note',
          targetType: 'patient',
          targetId: patient._id,
          relatedPatient: patient._id,
          visibility: 'patient_only',
          metadata: { category: 'pain', mood: 'negative' }
        },
        {
          author: patient._id,
          content: 'Note 3',
          commentType: 'patient_note',
          targetType: 'patient',
          targetId: patient._id,
          relatedPatient: patient._id,
          visibility: 'patient_only',
          metadata: { category: 'progress', mood: 'positive' }
        }
      ]);
    });

    it('should get all patient notes with pagination', async () => {
      const res = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toHaveLength(2);
      expect(res.body.data.pagination).toHaveProperty('totalCount');
      expect(res.body.data.pagination.totalCount).toBe(3);
    });

    it('should filter notes by category', async () => {
      const res = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ category: 'pain' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toHaveLength(1);
      expect(res.body.data.notes[0].metadata.category).toBe('pain');
    });

    it('should filter notes by date range', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({
          dateFrom: today.toISOString(),
          dateTo: tomorrow.toISOString()
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes.length).toBeGreaterThanOrEqual(0);
    });

    it('should only return notes for authenticated patient', async () => {
      // Create another patient and their notes
      const otherPatient = await User.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other@test.com',
        password: 'password123',
        role: 'patient',
        phoneNumber: '+1234567891'
      });

      await Comment.create({
        author: otherPatient._id,
        content: 'Other patient note',
        commentType: 'patient_note',
        targetType: 'patient',
        targetId: otherPatient._id,
        relatedPatient: otherPatient._id,
        visibility: 'patient_only'
      });

      const res = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toHaveLength(3); // Only original patient's notes
      expect(res.body.data.notes.every(note =>
        note.author._id.toString() === patient._id.toString()
      )).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/patients/notes');

      expect(res.status).toBe(401);
    });
  });

  describe('Notes Pagination', () => {
    beforeEach(async () => {
      // Create 25 notes for pagination testing
      const notes = [];
      for (let i = 1; i <= 25; i++) {
        notes.push({
          author: patient._id,
          content: `Note ${i}`,
          commentType: 'patient_note',
          targetType: 'patient',
          targetId: patient._id,
          relatedPatient: patient._id,
          visibility: 'patient_only',
          metadata: { category: 'general' }
        });
      }
      await Comment.create(notes);
    });

    it('should handle pagination correctly', async () => {
      // Get first page
      const page1 = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ page: 1, limit: 10 });

      expect(page1.body.data.notes).toHaveLength(10);
      expect(page1.body.data.pagination.currentPage).toBe(1);
      expect(page1.body.data.pagination.totalPages).toBe(3);
      expect(page1.body.data.pagination.hasNextPage).toBe(true);

      // Get second page
      const page2 = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ page: 2, limit: 10 });

      expect(page2.body.data.notes).toHaveLength(10);
      expect(page2.body.data.pagination.currentPage).toBe(2);
      expect(page2.body.data.pagination.hasPrevPage).toBe(true);
      expect(page2.body.data.pagination.hasNextPage).toBe(true);

      // Get third page
      const page3 = await request(app)
        .get('/api/patients/notes')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ page: 3, limit: 10 });

      expect(page3.body.data.notes).toHaveLength(5);
      expect(page3.body.data.pagination.hasNextPage).toBe(false);
    });
  });
});
