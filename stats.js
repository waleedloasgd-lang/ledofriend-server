const express = require('express');
const router = express.Router();
const moment = require('moment');
const authMiddleware = require('../middleware/auth');

module.exports = (db) => {
  const statsRef = db.collection('statistics');
  const sessionsRef = db.collection('sessions');

  // Get today's stats
  router.get('/today', authMiddleware, async (req, res) => {
    try {
      const today = moment().format('YYYY-MM-DD');
      const statId = `${req.user.id}_${today}`;
      const doc = await statsRef.doc(statId).get();

      const stats = doc.exists ? doc.data() : {
        totalFocusTime: 0,
        sessionsCount: 0,
        completedSessions: 0,
        date: today
      };

      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
    }
  });

  // Get weekly stats
  router.get('/weekly', authMiddleware, async (req, res) => {
    try {
      const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
      const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');

      const snapshot = await statsRef
        .where('userId', '==', req.user.id)
        .where('date', '>=', startOfWeek)
        .where('date', '<=', endOfWeek)
        .get();

      const dailyStats = [];
      let totalTime = 0;
      let totalSessions = 0;
      let completedSessions = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        dailyStats.push(data);
        totalTime += data.totalFocusTime || 0;
        totalSessions += data.sessionsCount || 0;
        completedSessions += data.completedSessions || 0;
      });

      // Fill missing days
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = moment().startOf('week').add(i, 'days').format('YYYY-MM-DD');
        const existing = dailyStats.find(s => s.date === day);
        weekDays.push({
          date: day,
          dayName: moment(day).format('dddd'),
          totalFocusTime: existing ? existing.totalFocusTime : 0,
          sessionsCount: existing ? existing.sessionsCount : 0,
          completedSessions: existing ? existing.completedSessions : 0
        });
      }

      // Find best day
      const bestDay = weekDays.reduce((best, day) => 
        day.totalFocusTime > (best?.totalFocusTime || 0) ? day : best, null);

      res.json({
        success: true,
        stats: {
          weekDays,
          totalTime,
          totalSessions,
          completedSessions,
          bestDay,
          avgDailyTime: Math.round(totalTime / 7)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات الأسبوعية' });
    }
  });

  // Get monthly stats
  router.get('/monthly', authMiddleware, async (req, res) => {
    try {
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

      const snapshot = await statsRef
        .where('userId', '==', req.user.id)
        .where('date', '>=', startOfMonth)
        .where('date', '<=', endOfMonth)
        .get();

      const dailyStats = [];
      let totalTime = 0;
      let totalSessions = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        dailyStats.push(data);
        totalTime += data.totalFocusTime || 0;
        totalSessions += data.sessionsCount || 0;
      });

      // Calculate streak
      let streak = 0;
      let checkDate = moment();
      while (true) {
        const dateStr = checkDate.format('YYYY-MM-DD');
        const found = dailyStats.find(s => s.date === dateStr && s.completedSessions > 0);
        if (found) {
          streak++;
          checkDate.subtract(1, 'day');
        } else {
          break;
        }
      }

      res.json({
        success: true,
        stats: {
          dailyStats,
          totalTime,
          totalSessions,
          streak,
          daysActive: dailyStats.length,
          avgDailyTime: dailyStats.length > 0 ? Math.round(totalTime / dailyStats.length) : 0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات الشهرية' });
    }
  });

  // Get all-time overview
  router.get('/overview', authMiddleware, async (req, res) => {
    try {
      const snapshot = await statsRef
        .where('userId', '==', req.user.id)
        .get();

      let totalTime = 0;
      let totalSessions = 0;
      let completedSessions = 0;
      let daysActive = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalTime += data.totalFocusTime || 0;
        totalSessions += data.sessionsCount || 0;
        completedSessions += data.completedSessions || 0;
        daysActive++;
      });

      // Get user level info
      const userDoc = await db.collection('users').doc(req.user.id).get();
      const userData = userDoc.data();

      res.json({
        success: true,
        stats: {
          totalTime,
          totalSessions,
          completedSessions,
          daysActive,
          points: userData?.points || 0,
          level: userData?.level || 1,
          achievements: userData?.achievements || [],
          completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب النظرة العامة' });
    }
  });

  return router;
};
