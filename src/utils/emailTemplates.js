const templates = {
  welcome: (name) => ({
    subject: 'Welcome to Social App',
    html: `<h1>Welcome ${name}!</h1><p>Your account has been created.</p>`,
  }),
  
  passwordReset: (url) => ({
    subject: 'Password Reset',
    html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
  }),
};

module.exports = templates;