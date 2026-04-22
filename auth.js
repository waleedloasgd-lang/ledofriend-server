const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');

module.exports = (db) => {
  const usersRef = db.collection('users');

  // Register
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
      }

      // Check if user exists
      const existingUser = await usersRef.where('email', '==', email).get();
      if (!existingUser.empty) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = uuidv4();

      const userData = {
        id: userId,
        name,
        email,
        password: hashedPassword,
        pin: null,
        points: 0,
        level: 1,
        achievements: [],
        settings: {
          focusDuration: 25,
          breakDuration: 5,
          pomodoroEnabled: true,
          hardModeEnabled: false,
          theme: 'dark',
          language: 'ar',
          blockedApps: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await usersRef.doc(userId).set(userData);

      const token = jwt.sign(
        { id: userId, email, name },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      const { password: _, ...userWithoutPassword } = userData;

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح',
        token,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ success: false, message: 'خطأ في إنشاء الحساب' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'البريد وكلمة المرور مطلوبان' });
      }

      const snapshot = await usersRef.where('email', '==', email).get();
      if (snapshot.empty) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
      }

      const token = jwt.sign(
        { id: userData.id, email: userData.email, name: userData.name },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      const { password: _, ...userWithoutPassword } = userData;

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'خطأ في تسجيل الدخول' });
    }
  });

  // Get current user
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const userDoc = await usersRef.doc(req.user.id).get();
      if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }

      const userData = userDoc.data();
      const { password, ...userWithoutPassword } = userData;

      res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
    }
  });

  // Update user
  router.put('/update', authMiddleware, async (req, res) => {
    try {
      const { name, pin } = req.body;
      const updates = { updatedAt: new Date().toISOString() };

      if (name) updates.name = name;
      if (pin) updates.pin = await bcrypt.hash(pin, 10);

      await usersRef.doc(req.user.id).update(updates);

      res.json({ success: true, message: 'تم تحديث البيانات' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في تحديث البيانات' });
    }
  });

  // Verify PIN
  router.post('/verify-pin', authMiddleware, async (req, res) => {
    try {
      const { pin } = req.body;
      const userDoc = await usersRef.doc(req.user.id).get();
      const userData = userDoc.data();

      if (!userData.pin) {
        return res.status(400).json({ success: false, message: 'لم يتم تعيين PIN' });
      }

      const isMatch = await bcrypt.compare(pin, userData.pin);
      res.json({ success: isMatch, message: isMatch ? 'PIN صحيح' : 'PIN غير صحيح' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في التحقق' });
    }
  });

  // Logout (client-side token removal, server acknowledgment)
  router.post('/logout', authMiddleware, (req, res) => {
    res.json({ success: true, message: 'تم تسجيل الخروج' });
  });

  return router;
};
