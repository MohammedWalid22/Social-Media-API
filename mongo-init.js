/* global db:writable */
db = db.getSiblingDB('social-media-api');
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [{ role: 'readWrite', db: 'socialapp' }]
});
