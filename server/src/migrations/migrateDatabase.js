const mongoose = require('mongoose');

/**
 * Idempotent migration to ensure backward compatibility, index consistency,
 * and safe non-destructive duplicate reconciliation for SmartPresence.
 * 
 * 1. Attendance:
 *    - Backfill missing sessionSlot to 'regular'
 *    - Safely drop obsolete unique index (className_1_subject_1_date_1)
 *    - Ensure compound unique index with sessionSlot (className_1_subject_1_date_1_sessionSlot_1)
 * 
 * 2. Student:
 *    - Backfill firstName and lastName from legacy single `name` field if missing.
 *    - Reconcile duplicate student identities based on normalized email and studentId:
 *      preserves all historical attendance records by repointing references to the canonical record.
 *    - Ensure role is set to 'student' and active flags are populated.
 * 
 * 3. Faculty:
 *    - Ensure isActive flag and backfill assignedSubjects from historical attendances.
 * 
 * 4. Subjects:
 *    - Seed canonical Subject collection from existing sessions and link faculty IDs.
 * 
 * 5. Admin:
 *    - Idempotently bootstrap configured initial Admin account.
 */
const runMigrations = async (conn = mongoose.connection) => {
  try {
    const db = conn.db || (conn.connection && conn.connection.db) || mongoose.connection.db;
    if (!db) {
      console.warn('⚠️ No active DB connection for migration.');
      return;
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

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
      const legacyIndex = indexes.find((idx) => idx.name === 'className_1_subject_1_date_1');
      if (legacyIndex) {
        console.log('[Migration] Dropping obsolete unique index className_1_subject_1_date_1 to permit distinct session slots...');
        await attendanceColl.dropIndex('className_1_subject_1_date_1');
        console.log('[Migration] Successfully dropped className_1_subject_1_date_1.');
      }

      // Ensure new compound unique index exists
      const hasSlotIndex = indexes.some((idx) => idx.name === 'className_1_subject_1_date_1_sessionSlot_1');
      if (!hasSlotIndex) {
        await attendanceColl.createIndex(
          { className: 1, subject: 1, date: 1, sessionSlot: 1 },
          { unique: true, background: true }
        );
        console.log('[Migration] Created compound unique index with sessionSlot.');
      }
    }

    // 2. Student migrations & safe duplicate reconciliation
    if (collectionNames.includes('students')) {
      const studentColl = db.collection('students');
      const attendanceColl = collectionNames.includes('attendances') ? db.collection('attendances') : null;
      const faceTemplateColl = collectionNames.includes('facetemplates') ? db.collection('facetemplates') : null;

      // Find legacy students with name but without firstName or lastName
      const legacyStudents = await studentColl
        .find({
          $or: [
            { firstName: { $exists: false } },
            { firstName: null },
            { firstName: '' },
            { lastName: { $exists: false } },
            { lastName: null },
            { lastName: '' },
          ],
        })
        .toArray();

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
              role: student.role || 'student',
            },
          }
        );
      }

      if (legacyStudents.length > 0) {
        console.log(`[Migration] Backfilled firstName/lastName for ${legacyStudents.length} legacy student records.`);
      }

      // Safe non-destructive reconciliation for duplicate students by normalized email
      const duplicateEmailGroups = await studentColl
        .aggregate([
          { $match: { email: { $exists: true, $ne: '' } } },
          { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      for (const group of duplicateEmailGroups) {
        const studentDocs = await studentColl.find({ _id: { $in: group.ids } }).toArray();
        // Canonical record preference: enrolled face template first, then earliest created
        studentDocs.sort((a, b) => {
          if (a.faceEnrollmentStatus === 'enrolled' && b.faceEnrollmentStatus !== 'enrolled') return -1;
          if (b.faceEnrollmentStatus === 'enrolled' && a.faceEnrollmentStatus !== 'enrolled') return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const canonical = studentDocs[0];
        const duplicates = studentDocs.slice(1);

        for (const dup of duplicates) {
          // Re-point historical attendance references from duplicate to canonical
          if (attendanceColl) {
            await attendanceColl.updateMany(
              { 'students.studentId': dup._id },
              { $set: { 'students.$[elem].studentId': canonical._id } },
              { arrayFilters: [{ 'elem.studentId': dup._id }] }
            );
          }

          // Transfer face template if canonical does not have one
          if (faceTemplateColl) {
            const canonicalTmpl = await faceTemplateColl.findOne({ studentId: canonical._id });
            if (!canonicalTmpl) {
              await faceTemplateColl.updateMany(
                { studentId: dup._id },
                { $set: { studentId: canonical._id } }
              );
            }
          }

          // Deactivate duplicate safely and adjust email to preserve unique index
          await studentColl.updateOne(
            { _id: dup._id },
            {
              $set: {
                isActive: false,
                isMerged: true,
                mergedInto: canonical._id,
                email: `${dup.email}.merged.${dup._id}`,
              },
            }
          );

          console.log(`[Migration] Reconciled duplicate student "${dup.studentId}" (${dup.email}) into canonical "${canonical.studentId}". Preserved attendance history.`);
        }
      }

      // Ensure isActive and creatorModel defaults
      await studentColl.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
      await studentColl.updateMany({ creatorModel: { $exists: false } }, { $set: { creatorModel: 'Faculty' } });
    }

    // 3. Faculty migrations: ensure isActive and backfill assignedSubjects from attendance history
    if (collectionNames.includes('faculties')) {
      const facultyColl = db.collection('faculties');
      await facultyColl.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
      await facultyColl.updateMany({ assignedSubjects: { $exists: false } }, { $set: { assignedSubjects: [] } });

      // Backfill assignedSubjects from historical attendance if empty
      if (collectionNames.includes('attendances')) {
        const attendanceColl = db.collection('attendances');
        const faculties = await facultyColl.find({}).toArray();

        for (const fac of faculties) {
          if (!fac.assignedSubjects || fac.assignedSubjects.length === 0) {
            const historicalSubjects = await attendanceColl.distinct('subject', { facultyId: fac._id });
            if (historicalSubjects && historicalSubjects.length > 0) {
              await facultyColl.updateOne(
                { _id: fac._id },
                { $set: { assignedSubjects: historicalSubjects } }
              );
              console.log(
                `[Migration] Backfilled ${historicalSubjects.length} assigned subject(s) for faculty: ${fac.name || fac.email}`
              );
            }
          }
        }
      }
    }

    // 4. Subject collection migration: ensure indexes and seed from historical attendances
    const Subject = require('../models/Subject');
    if (collectionNames.includes('attendances')) {
      const attendanceColl = db.collection('attendances');
      const distinctSessions = await attendanceColl
        .aggregate([
          { $group: { _id: { subject: '$subject', className: '$className' }, facultyIds: { $addToSet: '$facultyId' } } },
        ])
        .toArray();

      for (const item of distinctSessions) {
        if (item._id && item._id.subject) {
          const subjectName = item._id.subject.trim();
          const className = item._id.className ? item._id.className.trim() : '';
          const existingSubject = await Subject.findOne({ name: subjectName, className });
          if (!existingSubject) {
            await Subject.create({
              name: subjectName,
              className,
              facultyIds: (item.facultyIds || []).filter(Boolean),
              isActive: true,
            });
            console.log(`[Migration] Created canonical subject record: "${subjectName}" (${className || 'All'})`);
          } else if (item.facultyIds && item.facultyIds.length > 0) {
            // Merge facultyIds
            const existingIds = (existingSubject.facultyIds || []).map((id) => id.toString());
            const newIds = item.facultyIds.filter((id) => id && !existingIds.includes(id.toString()));
            if (newIds.length > 0) {
              existingSubject.facultyIds.push(...newIds);
              await existingSubject.save();
            }
          }
        }
      }
    }

    // 5. Idempotent Admin Bootstrap
    const bootstrapAdmin = require('../utils/bootstrapAdmin');
    await bootstrapAdmin();

    console.log('✅ Database migrations checked and up-to-date.');
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
  }
};

// Standalone execution support
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartpresence';

  mongoose
    .connect(uri)
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
