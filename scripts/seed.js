const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const database = require('../src/config/database');
const logger = require('../src/utils/logger');

// Check if faker is installed
let fakerAvailable = false;
try {
  require('@faker-js/faker');
  fakerAvailable = true;
} catch (e) {
  logger.warn('@faker-js/faker not installed. Run: npm install -D @faker-js/faker');
}

const seedDatabase = async () => {
  try {
    await database.connect();

    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});

    // Create admin user
    const admin = await User.create({
      email: 'admin@socialapp.com',
      password: 'Admin123!',
      username: 'admin',
      displayName: 'Administrator',
      role: 'admin',
      isVerified: true,
      isEmailVerified: true,
      dataConsent: { given: true, date: new Date(), version: '1.0' },
    });
    logger.info('Admin created:', admin.email);

    // Create test users
    const users = [];
    const userCount = fakerAvailable ? 20 : 5;

    for (let i = 0; i < userCount; i++) {
      const user = await User.create({
        email: fakerAvailable ? faker.internet.email() : `user${i}@test.com`,
        password: 'Password123!',
        username: fakerAvailable ? faker.internet.userName().toLowerCase().replace(/[^a-z0-9_]/g, '') : `user${i}`,
        displayName: fakerAvailable ? faker.person.fullName() : `User ${i}`,
        bio: fakerAvailable ? faker.lorem.sentence() : 'Test bio',
        isVerified: Math.random() > 0.8,
        isEmailVerified: true,
        privacySettings: {
          profileVisibility: Math.random() > 0.3 ? 'public' : 'friends',
          postVisibility: 'public',
        },
        dataConsent: { given: true, date: new Date(), version: '1.0' },
      });
      users.push(user);
    }
    logger.info(`${users.length} users created`);

    // Create follow relationships
    for (const user of users) {
      const followCount = Math.floor(Math.random() * 10) + 1;
      const toFollow = users
        .filter(u => u._id.toString() !== user._id.toString())
        .sort(() => 0.5 - Math.random())
        .slice(0, followCount);

      for (const target of toFollow) {
        user.following.push(target._id);
        target.followers.push(user._id);
        await target.save();
      }
      await user.save();
    }
    logger.info('Follow relationships created');

    // Create posts
    const posts = [];
    const postCount = fakerAvailable ? 100 : 20;

    for (let i = 0; i < postCount; i++) {
      const author = users[Math.floor(Math.random() * users.length)];
      const hasHashtags = Math.random() > 0.5;
      const hasMentions = Math.random() > 0.7;
      
      let content = fakerAvailable ? faker.lorem.paragraph() : `Test post content ${i}`;
      
      if (hasHashtags) {
        const hashtags = ['technology', 'lifestyle', 'travel', 'food', 'photography']
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * 3) + 1);
        content += ' ' + hashtags.map(h => `#${h}`).join(' ');
      }

      const post = await Post.create({
        author: author._id,
        content: { text: content },
        visibility: Math.random() > 0.2 ? 'public' : 'friends',
        hashtags: content.match(/#(\w+)/g)?.map(h => h.slice(1).toLowerCase()) || [],
        likes: [],
        likesCount: Math.floor(Math.random() * 100),
        commentsCount: Math.floor(Math.random() * 20),
        moderationStatus: 'approved',
      });
      posts.push(post);
    }
    logger.info(`${posts.length} posts created`);

    // Create comments
    for (const post of posts) {
      const commentCount = Math.floor(Math.random() * 5);
      
      for (let i = 0; i < commentCount; i++) {
        const commenter = users[Math.floor(Math.random() * users.length)];
        
        await Comment.create({
          post: post._id,
          author: commenter._id,
          content: fakerAvailable ? faker.lorem.sentence() : 'Test comment',
          contentType: 'text',
          likes: [],
          likesCount: Math.floor(Math.random() * 10),
          moderationStatus: 'approved',
        });
      }
    }
    logger.info('Comments created');

    // Create some stories
    for (const user of users.slice(0, 10)) {
      await require('../src/models/Story').create({
        author: user._id,
        content: {
          type: 'text',
          text: fakerAvailable ? faker.lorem.words(3) : 'Story text',
          backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'][Math.floor(Math.random() * 4)],
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
    logger.info('Stories created');

    logger.info('✅ Database seeded successfully!');
    logger.info(`
      Login credentials:
      Admin: admin@socialapp.com / Admin123!
      Users: user0@test.com - user${users.length - 1}@test.com / Password123!
    `);

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;