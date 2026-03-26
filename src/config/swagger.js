const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media API',
      version: '1.0.0',
      description: 'Professional API documentation for the Social Media Backend',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current Environment API',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'قم بإدخال رمز التوكن (JWT) هنا بدءاً من كلمة Bearer متبوعة بمسافة ثم التوكن'
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // مسارات الملفات التي تحتوي على تعليقات JSDoc الخاص بالـ API
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
