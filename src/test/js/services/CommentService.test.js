const mongoose = require('mongoose');
const CommentService = require('../../../main/js/services/CommentService');
const User = require('../../../main/js/models/User');
const Comment = require('../../../main/js/models/Comment');
const RehabTask = require('../../../main/js/models/RehabTask');

describe('CommentService', () => {
  let patientId, physiotherapistId, doctorId;
  let rehabTaskId, commentId;

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

  describe('createComment', () => {
    it('should create a new comment successfully', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'This is a test comment',
        commentType: 'feedback'
      };

      const result = await CommentService.createComment(physiotherapistId, commentData);

      expect(result.success).toBe(true);
      expect(result.data.comment.content).toBe(commentData.content);
      expect(result.data.comment.author._id.toString()).toBe(physiotherapistId.toString());
      expect(result.data.comment.targetType).toBe(commentData.targetType);
      expect(result.data.notifications).toBeDefined();
    });

    it('should handle mentions in comments', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: `This is a comment mentioning @${doctorId}`,
        commentType: 'feedback'
      };

      const result = await CommentService.createComment(physiotherapistId, commentData);

      expect(result.success).toBe(true);
      expect(result.data.comment.mentions).toHaveLength(1);
      expect(result.data.comment.mentions[0].user.toString()).toBe(doctorId.toString());
    });

    it('should validate patient access', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: doctorId, // Doctor is not a patient
        content: 'This should fail',
        commentType: 'feedback'
      };

      await expect(CommentService.createComment(physiotherapistId, commentData))
        .rejects.toThrow('Invalid patient reference');
    });

    it('should sanitize content', async () => {
      const commentData = {
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: '<script>alert("xss")</script>This is safe content',
        commentType: 'feedback'
      };

      const result = await CommentService.createComment(physiotherapistId, commentData);

      expect(result.success).toBe(true);
      expect(result.data.comment.content).not.toContain('<script>');
      expect(result.data.comment.content).toContain('This is safe content');
    });
  });

  describe('getThreadedComments', () => {
    beforeEach(async () => {
      // Create parent comment
      const parentComment = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Parent comment',
        commentType: 'feedback'
      });

      // Create reply
      await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Reply comment',
        commentType: 'response',
        parentComment: parentComment._id,
        isReply: true,
        replyTo: physiotherapistId
      });

      commentId = parentComment._id;
    });

    it('should get threaded comments with replies', async () => {
      const result = await CommentService.getThreadedComments(
        'rehabTask',
        rehabTaskId,
        patientId,
        { includeReplies: true }
      );

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.threadStructure).toBeDefined();
    });

    it('should filter by status', async () => {
      // Create archived comment
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Archived comment',
        commentType: 'feedback',
        status: 'archived'
      });

      const result = await CommentService.getThreadedComments(
        'rehabTask',
        rehabTaskId,
        patientId,
        { status: 'active' }
      );

      expect(result.success).toBe(true);
      expect(result.data.comments.every(c => c.status === 'active')).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await CommentService.getThreadedComments(
        'rehabTask',
        rehabTaskId,
        patientId,
        { page: 1, limit: 1 }
      );

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.pagination.totalPages).toBeGreaterThan(1);
    });
  });

  describe('addReaction', () => {
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
      const result = await CommentService.addReaction(commentId, patientId, 'helpful');

      expect(result.success).toBe(true);
      expect(result.data.comment.reactions).toHaveLength(1);
      expect(result.data.comment.reactions[0].type).toBe('helpful');
      expect(result.data.comment.reactions[0].user.toString()).toBe(patientId.toString());
    });

    it('should replace existing reaction from same user', async () => {
      // Add first reaction
      await CommentService.addReaction(commentId, patientId, 'helpful');

      // Add different reaction from same user
      const result = await CommentService.addReaction(commentId, patientId, 'like');

      expect(result.success).toBe(true);
      expect(result.data.comment.reactions).toHaveLength(1);
      expect(result.data.comment.reactions[0].type).toBe('like');
    });

    it('should validate reaction type', async () => {
      await expect(CommentService.addReaction(commentId, patientId, 'invalid'))
        .rejects.toThrow();
    });
  });

  describe('editComment', () => {
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
      const newContent = 'Updated content';
      const editReason = 'Clarification needed';

      const result = await CommentService.editComment(
        commentId,
        physiotherapistId,
        newContent,
        editReason
      );

      expect(result.success).toBe(true);
      expect(result.data.comment.content).toBe(newContent);
      expect(result.data.comment.edited.isEdited).toBe(true);
      expect(result.data.comment.edited.editReason).toBe(editReason);
      expect(result.data.comment.edited.originalContent).toBe('Original content');
    });

    it('should not allow editing by non-author', async () => {
      await expect(CommentService.editComment(
        commentId,
        patientId,
        'Updated content'
      )).rejects.toThrow('Access denied');
    });

    it('should sanitize edited content', async () => {
      const maliciousContent = '<script>alert("xss")</script>Safe content';

      const result = await CommentService.editComment(
        commentId,
        physiotherapistId,
        maliciousContent
      );

      expect(result.success).toBe(true);
      expect(result.data.comment.content).not.toContain('<script>');
      expect(result.data.comment.content).toContain('Safe content');
    });
  });

  describe('deleteComment', () => {
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
      const result = await CommentService.deleteComment(commentId, physiotherapistId);

      expect(result.success).toBe(true);

      // Verify comment is deleted
      const deletedComment = await Comment.findById(commentId);
      expect(deletedComment).toBeNull();
    });

    it('should handle thread cleanup when deleting parent comment', async () => {
      // Create reply
      const reply = await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Reply to be orphaned',
        commentType: 'response',
        parentComment: commentId,
        isReply: true,
        replyTo: physiotherapistId
      });

      const result = await CommentService.deleteComment(commentId, physiotherapistId);

      expect(result.success).toBe(true);

      // Verify reply is updated to no longer reference deleted parent
      const updatedReply = await Comment.findById(reply._id);
      expect(updatedReply.parentComment).toBeNull();
      expect(updatedReply.isReply).toBe(false);
    });

    it('should not allow deletion by non-author', async () => {
      await expect(CommentService.deleteComment(commentId, patientId))
        .rejects.toThrow('Access denied');
    });
  });

  describe('searchComments', () => {
    beforeEach(async () => {
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Exercise feedback regarding progress',
        commentType: 'feedback',
        tags: ['exercise', 'progress']
      });

      await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Question about pain levels',
        commentType: 'question',
        tags: ['pain', 'concern']
      });
    });

    it('should search comments by content', async () => {
      const result = await CommentService.searchComments(patientId, {
        query: 'exercise',
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.comments[0].content).toContain('Exercise');
    });

    it('should filter by comment type', async () => {
      const result = await CommentService.searchComments(patientId, {
        query: '',
        commentType: 'question',
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.comments[0].commentType).toBe('question');
    });

    it('should filter by tags', async () => {
      const result = await CommentService.searchComments(patientId, {
        query: '',
        tags: 'exercise,progress',
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.comments[0].tags).toContain('exercise');
    });
  });

  describe('getDiscussionAnalytics', () => {
    beforeEach(async () => {
      // Create multiple comments with different types and reactions
      const comment1 = await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Feedback comment',
        commentType: 'feedback',
        reactions: [{ user: patientId, type: 'helpful' }]
      });

      await Comment.create({
        author: patientId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Question comment',
        commentType: 'question',
        parentComment: comment1._id,
        isReply: true,
        replyTo: physiotherapistId
      });
    });

    it('should provide discussion analytics', async () => {
      const result = await CommentService.getDiscussionAnalytics(
        'rehabTask',
        rehabTaskId,
        physiotherapistId
      );

      expect(result.success).toBe(true);
      expect(result.data.analytics.totalComments).toBe(2);
      expect(result.data.analytics.totalReplies).toBe(1);
      expect(result.data.analytics.commentTypes.feedback).toBe(1);
      expect(result.data.analytics.commentTypes.question).toBe(1);
      expect(result.data.analytics.engagementScore).toBeGreaterThan(0);
      expect(result.data.analytics.topContributors).toBeDefined();
    });
  });

  describe('getUnreadComments', () => {
    beforeEach(async () => {
      // Create unread comment
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Unread comment',
        commentType: 'feedback',
        visibleTo: [{ user: patientId, role: 'patient' }]
      });

      // Create read comment
      await Comment.create({
        author: physiotherapistId,
        targetType: 'rehabTask',
        targetId: rehabTaskId,
        relatedPatient: patientId,
        content: 'Read comment',
        commentType: 'feedback',
        visibleTo: [{ user: patientId, role: 'patient' }],
        readBy: [{ user: patientId }]
      });
    });

    it('should get unread comments for user', async () => {
      const result = await CommentService.getUnreadComments(patientId, {});

      expect(result.success).toBe(true);
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.comments[0].content).toBe('Unread comment');
      expect(result.data.unreadCount).toBe(1);
    });

    it('should filter unread comments by type', async () => {
      const result = await CommentService.getUnreadComments(patientId, {
        commentType: 'feedback'
      });

      expect(result.success).toBe(true);
      expect(result.data.comments.every(c => c.commentType === 'feedback')).toBe(true);
    });
  });
});