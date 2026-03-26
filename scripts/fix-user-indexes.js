/**
 * One-time migration script to fix the parallel array index issue on the users collection.
 * Run with: node scripts/fix-user-indexes.js
 */
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

async function fixIndexes() {
  console.log('🔧 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/socialapp');
  console.log('✅ Connected');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  // List existing indexes
  const indexes = await usersCollection.indexes();
  console.log('\n📋 Current indexes on users collection:');
  indexes.forEach(idx => console.log(' -', JSON.stringify(idx.key)));

  // Drop the problematic compound parallel array index if it exists
  const problematicIndex = indexes.find(idx =>
    idx.key.followers !== undefined && idx.key.following !== undefined
  );

  if (problematicIndex) {
    console.log('\n⚠️  Found problematic compound index:', JSON.stringify(problematicIndex.key));
    await usersCollection.dropIndex(problematicIndex.name);
    console.log('✅ Dropped compound index:', problematicIndex.name);
  } else {
    console.log('\n✅ No problematic compound index found — nothing to drop.');
  }

  // Also drop solo followers index if it has a duplicate (inline + schema.index)
  const followersIndexes = indexes.filter(idx =>
    Object.keys(idx.key).length === 1 && idx.key.followers !== undefined
  );
  if (followersIndexes.length > 1) {
    console.log(`\n⚠️  Found ${followersIndexes.length} duplicate followers indexes. Dropping extras...`);
    // Keep the first, drop the rest
    for (let i = 1; i < followersIndexes.length; i++) {
      await usersCollection.dropIndex(followersIndexes[i].name);
      console.log('✅ Dropped duplicate index:', followersIndexes[i].name);
    }
  }

  console.log('\n🎉 Index fix complete! Run npm start now.');
  await mongoose.disconnect();
  process.exit(0);
}

fixIndexes().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
