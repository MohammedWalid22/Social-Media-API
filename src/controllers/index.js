// Central export for all controllers
module.exports = {
  authController: require('./authController'),
  userController: require('./userController'),
  postController: require('./postController'),
  commentController: require('./commentController'),
  feedController: require('./feedController'),
  messageController: require('./messageController'),
  notificationController: require('./notificationController'),
  storyController: require('./storyController'),
  adminController: require('./adminController'),
};