const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

module.exports = (db) => {
  const usersRef = db.collection('users');
  const settingsRef = db.collection('settings');

  // Get settings
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const settingsDoc = await settingsRef.doc(req.user.id).get();
      
      if (settingsDoc.exists) {
        res.json({ success: true, settings: settingsDoc.data() });
      } else {
        // Return default settings
        const defaults = {
          userId: req.user.id,
          focusDuration: 25,
          breakDuration: 5,
          longBreakDuration: 15,
          pomodoroRounds: 4,
          pomodoroEnabled: true,
          hardModeEnabled: false,
          deviceLockEnabled: false,
          notificationBlock: true,
          soundBlock: true,
          theme: 'dark',
          language: 'ar',
          blockedApps: [],
          allowedAppsInLock: [],
          scheduledSessions: [],
          pin: null,
          createdAt: new Date().toISOString()
        };
        await settingsRef.doc(req.user.id).set(defaults);
        res.json({ success: true, settings: defaults });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب الإعدادات' });
    }
  });

  // Update settings
  router.put('/', authMiddleware, async (req, res) => {
    try {
      const allowedFields = [
        'focusDuration', 'breakDuration', 'longBreakDuration',
        'pomodoroRounds', 'pomodoroEnabled', 'hardModeEnabled',
        'deviceLockEnabled', 'notificationBlock', 'soundBlock',
        'theme', 'language', 'blockedApps', 'allowedAppsInLock',
        'scheduledSessions'
      ];

      const updates = { updatedAt: new Date().toISOString() };
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      await settingsRef.doc(req.user.id).update(updates);

      res.json({ success: true, message: 'تم تحديث الإعدادات' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في تحديث الإعدادات' });
    }
  });

  // Update blocked apps
  router.put('/blocked-apps', authMiddleware, async (req, res) => {
    try {
      const { blockedApps } = req.body;
      
      await settingsRef.doc(req.user.id).update({
        blockedApps: blockedApps || [],
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, message: 'تم تحديث التطبيقات المحظورة' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في تحديث التطبيقات' });
    }
  });

  // Set PIN
  router.put('/pin', authMiddleware, async (req, res) => {
    try {
      const bcrypt = require('bcrypt');
      const { pin } = req.body;

      if (!pin || pin.length < 4) {
        return res.status(400).json({ success: false, message: 'PIN يجب أن يكون 4 أرقام على الأقل' });
      }

      const hashedPin = await bcrypt.hash(pin, 10);
      
      await settingsRef.doc(req.user.id).update({
        pin: hashedPin,
        updatedAt: new Date().toISOString()
      });

      await usersRef.doc(req.user.id).update({ pin: hashedPin });

      res.json({ success: true, message: 'تم تعيين PIN' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في تعيين PIN' });
    }
  });

  // Schedule session
  router.post('/schedule', authMiddleware, async (req, res) => {
    try {
      const { dayOfWeek, time, duration, type, repeat } = req.body;

      const settingsDoc = await settingsRef.doc(req.user.id).get();
      const settings = settingsDoc.data();
      const scheduled = settings.scheduledSessions || [];

      scheduled.push({
        id: Date.now().toString(),
        dayOfWeek,
        time,
        duration,
        type: type || 'focus',
        repeat: repeat || 'weekly',
        enabled: true,
        createdAt: new Date().toISOString()
      });

      await settingsRef.doc(req.user.id).update({
        scheduledSessions: scheduled,
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, message: 'تمت جدولة الجلسة' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جدولة الجلسة' });
    }
  });

  return router;
};
