db = db.getSiblingDB('socialapp');
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [{ role: 'readWrite', db: 'socialapp' }]
});
