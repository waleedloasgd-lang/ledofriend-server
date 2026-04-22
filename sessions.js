const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const authMiddleware = require('../middleware/auth');

module.exports = (db) => {
  const sessionsRef = db.collection('sessions');
  const statsRef = db.collection('statistics');

  // Create session
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { type, duration, blockedApps, mode } = req.body;
      const sessionId = uuidv4();

      const sessionData = {
        id: sessionId,
        userId: req.user.id,
        type: type || 'focus',
        duration: duration || 25,
        startTime: new Date().toISOString(),
        endTime: null,
        completed: false,
        blockedApps: blockedApps || [],
        mode: mode || 'normal',
        pausedTime: 0,
        createdAt: new Date().toISOString()
      };

      await sessionsRef.doc(sessionId).set(sessionData);

      res.status(201).json({ success: true, session: sessionData });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في إنشاء الجلسة' });
    }
  });

  // Complete session
  router.put('/:id/complete', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { completed, actualDuration } = req.body;

      await sessionsRef.doc(id).update({
        endTime: new Date().toISOString(),
        completed: completed !== false,
        actualDuration: actualDuration || 0
      });

      // Update statistics
      const today = moment().format('YYYY-MM-DD');
      const statId = `${req.user.id}_${today}`;
      const statDoc = await statsRef.doc(statId).get();

      if (statDoc.exists) {
        const existing = statDoc.data();
        await statsRef.doc(statId).update({
          totalFocusTime: existing.totalFocusTime + (actualDuration || 0),
          sessionsCount: existing.sessionsCount + 1,
          completedSessions: existing.completedSessions + (completed !== false ? 1 : 0),
          updatedAt: new Date().toISOString()
        });
      } else {
        await statsRef.doc(statId).set({
          id: statId,
          userId: req.user.id,
          date: today,
          totalFocusTime: actualDuration || 0,
          sessionsCount: 1,
          completedSessions: completed !== false ? 1 : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Update user points
      if (completed !== false) {
        const usersRef = db.collection('users');
        const userDoc = await usersRef.doc(req.user.id).get();
        const userData = userDoc.data();
        const pointsEarned = Math.floor((actualDuration || 0) / 5) * 10;
        const newPoints = (userData.points || 0) + pointsEarned;
        const newLevel = Math.floor(newPoints / 500) + 1;

        await usersRef.doc(req.user.id).update({
          points: newPoints,
          level: newLevel
        });
      }

      res.json({ success: true, message: 'تم إنهاء الجلسة' });
    } catch (error) {
      console.error('Complete session error:', error);
      res.status(500).json({ success: false, message: 'خطأ في تحديث الجلسة' });
    }
  });

  // Get user sessions
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const snapshot = await sessionsRef
        .where('userId', '==', req.user.id)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit))
        .get();

      const sessions = [];
      snapshot.forEach(doc => sessions.push(doc.data()));

      res.json({ success: true, sessions });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الجلسات' });
    }
  });

  // Get single session
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const doc = await sessionsRef.doc(req.params.id).get();
      if (!doc.exists || doc.data().userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
      }
      res.json({ success: true, session: doc.data() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الجلسة' });
    }
  });

  // Delete session
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      await sessionsRef.doc(req.params.id).delete();
      res.json({ success: true, message: 'تم حذف الجلسة' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في حذف الجلسة' });
    }
  });

  return router;
};
