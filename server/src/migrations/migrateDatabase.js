const mongoose = require('mongoose');

/**
 * Idempotent migration to ensure backward compatibility and index consistency
 * for SmartPresence enhanced schemas.
 * 
 * 1. Attendance:
 *    - Backfill missing sessionSlot to 'regular'
 *    - Safely drop obsolete unique index (className_1_subject_1_date_1) that prevented
 *      multiple legitimate sessions on the same date for the same class/subject.
 *    - Ensure compound unique index with sessionSlot (className_1_subject_1_date_1_sessionSlot_1) exists.
 * 
 * 2. Student:
 *    - Backfill firstName and lastName from legacy single `name` field if missing.
 *    - Ensure role is set to 'student'.
 */
const runMigrations = async (conn = mongoose.connection) => {
  try {
    const db = conn.db || (conn.connection && conn.connection.db) || mongoose.connection.db;
    if (!db) {
      console.warn('⚠️ No active DB connection for migration.');
      return;
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // 1. Attendance migrations
    if (collectionNames.includes('attendances')) {
      const attendanceColl = db.collection('attendances');

      // Backfill missing sessionSlot
      const updateSlotResult = await attendanceColl.updateMany(
        { $or: [{ sessionSlot: { $exists: false } }, { sessionSlot: null }, { sessionSlot: '' }] },
        { $set: { sessionSlot: 'regular' } }
      );
      if (updateSlotResult.modifiedCount > 0) {
        console.log(`[Migration] Backfilled sessionSlot for ${updateSlotResult.modifiedCount} legacy attendance records.`);
      }

      // Check and drop obsolete index
      const indexes = await attendanceColl.indexes();
      const legacyIndex = indexes.find(idx => idx.name === 'className_1_subject_1_date_1');
      if (legacyIndex) {
        console.log('[Migration] Dropping obsolete unique index className_1_subject_1_date_1 to permit distinct session slots...');
        await attendanceColl.dropIndex('className_1_subject_1_date_1');
        console.log('[Migration] Successfully dropped className_1_subject_1_date_1.');
      }

      // Ensure new index exists
      const hasSlotIndex = indexes.some(idx => idx.name === 'className_1_subject_1_date_1_sessionSlot_1');
      if (!hasSlotIndex) {
        await attendanceColl.createIndex(
          { className: 1, subject: 1, date: 1, sessionSlot: 1 },
          { unique: true, background: true }
        );
        console.log('[Migration] Created compound unique index with sessionSlot.');
      }
    }

    // 2. Student migrations
    if (collectionNames.includes('students')) {
      const studentColl = db.collection('students');

      // Find legacy students with name but without firstName or lastName
      const legacyStudents = await studentColl.find({
        $or: [
          { firstName: { $exists: false } },
          { firstName: null },
          { firstName: '' },
          { lastName: { $exists: false } },
          { lastName: null },
          { lastName: '' }
        ]
      }).toArray();

      for (const student of legacyStudents) {
        const fullName = (student.name || '').trim();
        let fName = 'Student';
        let lName = student.rollNumber || 'User';

        if (fullName) {
          const parts = fullName.split(/\s+/);
          fName = parts[0] || 'Student';
          lName = parts.slice(1).join(' ') || parts[0];
        }

        await studentColl.updateOne(
          { _id: student._id },
          {
            $set: {
              firstName: student.firstName || fName,
              lastName: student.lastName || lName,
              role: student.role || 'student'
            }
          }
        );
      }

      if (legacyStudents.length > 0) {
        console.log(`[Migration] Backfilled firstName/lastName for ${legacyStudents.length} legacy student records.`);
      }
    }

    console.log('✅ Database migrations checked and up-to-date.');
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    // Non-blocking in production if partial migration failure occurs, but log clearly
  }
};

// Standalone execution support
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartpresence';
  
  mongoose.connect(uri)
    .then(async (conn) => {
      console.log(`Connected to MongoDB: ${conn.connection.name}`);
      await runMigrations(conn);
      await mongoose.disconnect();
      console.log('Migration finished and disconnected.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration connection error:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
