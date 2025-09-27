const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../main/js/server');
const User = require('../../../main/js/models/User');
const Comment = require('../../../main/js/models/Comment');
const RehabTask = require('../../../main/js/models/RehabTask');
const jwt = require('jsonwebtoken');

describe('Comment Routes', () => {
  let patientToken, physiotherapistToken, doctorToken;
  let patientId, physiotherapistId, doctorId;
  let rehabTaskId, commentId, parentCommentId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Comment.deleteMany({});
    await RehabTask.deleteMany({});

    // Create test users
    const patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    const physiotherapist = await User.create({
      firstName: 'Test',
      lastName: 'Physiotherapist',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567891',
      assignedPatients: [patient._id]
    });

    const doctor = await User.create({
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

    patientToken = jwt.sign({ userId: patient._id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    physiotherapistToken = jwt.sign({ userId: physiotherapist._id, role: 'physiotherapist' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    doctorToken = jwt.sign({ userId: doctor._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create a test rehab task
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
        reps: 10,
        duration: null,
        restBetweenSets: 60
      }]
    });

    rehabTaskId = rehabTask._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/comments', () => {
    it('should create a new comment', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'This is a test comment',
        commentType: 'feedback'
      };

      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${physiotherapistToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(commentData.content);
      expect(response.body.data.comment.commentType).toBe(commentData.commentType);
      expect(response.body.data.comment.author._id).toBe(physiotherapistId.toString());

      commentId = response.body.data.comment._id;
    });

    it('should require authentication', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'This is a test comment',
        commentType: 'feedback'
      };

      await request(app)
        .post('/api/comments')
        .send(commentData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        content: 'This is a test comment'
      };

      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${physiotherapistToken}`)
        .send(incompleteData)
        .expect(400);
    });
  });

  describe('GET /api/comments/:targetType/:targetId', () => {
    beforeEach(async () => {
      // Create test comments
      const comment1 = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'First comment',
        commentType: 'feedback'
      });

      const comment2 = await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Patient response',
        commentType: 'question',
        parentComment: comment1._id,
        isReply: true,
        replyTo: physiotherapistId
      });

      commentId = comment1._id;
    });

    it('should get threaded comments for a target', async () => {
      const response = await request(app)
        .get(`/api/comments/rehabTask/${rehabTaskId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toHaveLength(2);
      expect(response.body.data.totalCount).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/comments/rehabTask/${rehabTaskId}?limit=1&page=1`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toHaveLength(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/comments/rehabTask/${rehabTaskId}?status=active`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comments.every(c => c.status === 'active')).toBe(true);
    });
  });

  describe('GET /api/comments/:commentId', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Test comment',
        commentType: 'feedback'
      });
      commentId = comment._id;
    });

    it('should get specific comment with thread context', async () => {
      const response = await request(app)
        .get(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment._id).toBe(commentId.toString());
      expect(response.body.data.comment.content).toBe('Test comment');
    });

    it('should return 404 for non-existent comment', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/comments/${fakeId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Original content',
        commentType: 'feedback'
      });
      commentId = comment._id;
    });

    it('should edit comment by author', async () => {
      const updateData = {
        content: 'Updated content',
        editReason: 'Clarification needed'
      };

      const response = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${physiotherapistToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(updateData.content);
      expect(response.body.data.comment.edited.isEdited).toBe(true);
      expect(response.body.data.comment.edited.editReason).toBe(updateData.editReason);
    });

    it('should not allow editing by non-author', async () => {
      const updateData = {
        content: 'Updated content'
      };

      await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'To be deleted',
        commentType: 'feedback'
      });
      commentId = comment._id;
    });

    it('should delete comment by author', async () => {
      const response = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${physiotherapistToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not allow deletion by non-author', async () => {
      await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(400);
    });
  });

  describe('POST /api/comments/:commentId/reply', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Parent comment',
        commentType: 'feedback'
      });
      parentCommentId = comment._id;
    });

    it('should reply to a comment', async () => {
      const replyData = {
        content: 'This is a reply',
        commentType: 'response'
      };

      const response = await request(app)
        .post(`/api/comments/${parentCommentId}/reply`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(replyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(replyData.content);
      expect(response.body.data.comment.isReply).toBe(true);
      expect(response.body.data.comment.parentComment).toBe(parentCommentId.toString());
    });
  });

  describe('POST /api/comments/:commentId/reactions', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Comment to react to',
        commentType: 'feedback'
      });
      commentId = comment._id;
    });

    it('should add reaction to comment', async () => {
      const reactionData = {
        type: 'helpful'
      };

      const response = await request(app)
        .post(`/api/comments/${commentId}/reactions`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(reactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.reactions).toHaveLength(1);
      expect(response.body.data.comment.reactions[0].type).toBe('helpful');
    });

    it('should validate reaction type', async () => {
      const reactionData = {
        type: 'invalid'
      };

      await request(app)
        .post(`/api/comments/${commentId}/reactions`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(reactionData)
        .expect(400);
    });
  });

  describe('DELETE /api/comments/:commentId/reactions', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Comment with reaction',
        commentType: 'feedback',
        reactions: [{
          user: patientId,
          type: 'helpful'
        }]
      });
      commentId = comment._id;
    });

    it('should remove reaction from comment', async () => {
      const response = await request(app)
        .delete(`/api/comments/${commentId}/reactions`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.reactions).toHaveLength(0);
    });
  });

  describe('POST /api/comments/:commentId/read', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Unread comment',
        commentType: 'feedback'
      });
      commentId = comment._id;
    });

    it('should mark comment as read', async () => {
      const response = await request(app)
        .post(`/api/comments/${commentId}/read`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.readBy).toHaveLength(1);
      expect(response.body.data.comment.readBy[0].user).toBe(patientId.toString());
    });
  });

  describe('GET /api/comments/unread', () => {
    beforeEach(async () => {
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Unread comment',
        commentType: 'feedback',
        visibleTo: [{ user: patientId, role: 'patient' }]
      });
    });

    it('should get unread comments for user', async () => {
      const response = await request(app)
        .get('/api/comments/unread')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.comments)).toBe(true);
    });
  });

  describe('GET /api/comments/search', () => {
    beforeEach(async () => {
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Searchable content here',
        commentType: 'feedback',
        tags: ['exercise', 'progress']
      });
    });

    it('should search comments by content', async () => {
      const response = await request(app)
        .get('/api/comments/search?q=searchable')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.comments)).toBe(true);
    });

    it('should filter search by comment type', async () => {
      const response = await request(app)
        .get('/api/comments/search?q=content&commentType=feedback')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.comments)).toBe(true);
    });
  });

  describe('PUT /api/comments/:commentId/resolve', () => {
    beforeEach(async () => {
      const comment = await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Question that needs resolution',
        commentType: 'question',
        requiresResponse: true
      });
      commentId = comment._id;
    });

    it('should resolve comment by healthcare provider', async () => {
      const response = await request(app)
        .put(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${physiotherapistToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.status).toBe('resolved');
    });

    it('should require healthcare provider role', async () => {
      await request(app)
        .put(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
  });
});