const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// For production, use a service account key file
// For development, we use the project ID
const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'rekaba-5667b',
      });
    }
    
    const db = admin.firestore();
    const auth = admin.auth();
    
    console.log('✅ Firebase Admin initialized successfully');
    
    return { db, auth, admin };
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    process.exit(1);
  }
};

module.exports = initializeFirebase;
