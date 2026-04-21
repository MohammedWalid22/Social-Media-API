const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media API',
      version: '1.0.0',
      description:
        'Professional REST API documentation for the Social Media Backend. ' +
        'Supports authentication, posts, comments, stories, notifications, real-time messaging, and more.',
      contact: {
        name: 'API Support',
        email: 'support@socialmedia.dev',
      },
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
          description: 'أدخل رمز JWT: Bearer <token>',
        },
      },
      schemas: {
        // ---- Generic Responses ----
        ErrorResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['fail', 'error'],
              example: 'fail',
            },
            message: {
              type: 'string',
              example: 'Resource not found',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success'],
              example: 'success',
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            results: {
              type: 'integer',
              description: 'Number of results in this page',
              example: 20,
            },
            page: {
              type: 'integer',
              description: 'Current page number',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Max results per page',
              example: 20,
            },
            nextCursor: {
              type: 'string',
              nullable: true,
              description: 'Cursor for the next page (cursor-based pagination)',
              example: '2024-01-15T10:30:00.000Z',
            },
          },
        },
        // ---- User ----
        UserPublic: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '65a1b2c3d4e5f6a7b8c9d0e1' },
            username: { type: 'string', example: 'john_doe' },
            displayName: { type: 'string', example: 'John Doe' },
            avatar: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/...' },
              },
            },
            isVerified: { type: 'boolean', example: false },
            bio: { type: 'string', example: 'Software engineer & coffee enthusiast' },
            followersCount: { type: 'integer', example: 1240 },
            followingCount: { type: 'integer', example: 380 },
          },
        },
        UserPrivate: {
          allOf: [
            { $ref: '#/components/schemas/UserPublic' },
            {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email', example: 'john@example.com' },
                twoFactorEnabled: { type: 'boolean', example: false },
                isEmailVerified: { type: 'boolean', example: true },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          ],
        },
        // ---- Auth ----
        AuthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            deviceId: { type: 'string', example: 'a1b2c3d4e5f6a7b8' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/UserPrivate' },
              },
            },
          },
        },
        // ---- Post ----
        PostMedia: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['image', 'video'], example: 'image' },
            url: { type: 'string', format: 'uri' },
            thumbnail: { type: 'string', format: 'uri' },
            metadata: {
              type: 'object',
              properties: {
                width: { type: 'integer' },
                height: { type: 'integer' },
                size: { type: 'integer' },
                format: { type: 'string' },
              },
            },
          },
        },
        Post: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '65a1b2c3d4e5f6a7b8c9d0e1' },
            author: { $ref: '#/components/schemas/UserPublic' },
            content: {
              type: 'object',
              properties: {
                text: { type: 'string', example: 'Hello world! #social @friend' },
              },
            },
            media: {
              type: 'array',
              items: { $ref: '#/components/schemas/PostMedia' },
            },
            visibility: {
              type: 'string',
              enum: ['public', 'friends', 'followers', 'private', 'custom'],
              example: 'public',
            },
            likesCount: { type: 'integer', example: 42 },
            commentsCount: { type: 'integer', example: 7 },
            sharesCount: { type: 'integer', example: 3 },
            isLiked: { type: 'boolean', example: false },
            hashtags: { type: 'array', items: { type: 'string' }, example: ['social', 'tech'] },
            createdAt: { type: 'string', format: 'date-time' },
            isEdited: { type: 'boolean', example: false },
          },
        },
        // ---- Comment ----
        Comment: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '65a1b2c3d4e5f6a7b8c9d0e2' },
            author: { $ref: '#/components/schemas/UserPublic' },
            content: { type: 'string', example: 'Great post!' },
            likesCount: { type: 'integer', example: 5 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ---- Validation Error ----
        ValidationError: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'fail' },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Please provide a valid email address' },
                  value: { type: 'string', example: 'not-an-email' },
                },
              },
            },
          },
        },
      },
      // ---- Reusable Response objects ----
      responses: {
        Unauthorized: {
          description: 'Unauthorized — missing or invalid JWT token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'fail', message: 'Invalid token. Please log in again.' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'fail', message: 'Post not found' },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden — insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        BadRequest: {
          description: 'Bad request — validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'error', message: 'Something went wrong!' },
            },
          },
        },
      },
      // ---- Reusable Parameters ----
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number (1-indexed)',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Number of results per page (max 100)',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & session management' },
      { name: 'Users', description: 'User profiles, follow system, and settings' },
      { name: 'Posts', description: 'Post creation, reactions, and sharing' },
      { name: 'Comments', description: 'Text and audio comments' },
      { name: 'Feed', description: 'Personalized feed, trending, and nearby posts' },
      { name: 'Messages', description: 'Direct messaging' },
      { name: 'Notifications', description: 'In-app notifications' },
      { name: 'Stories', description: 'Ephemeral story posts' },
      { name: 'Stickers', description: 'Sticker comments system' },
      { name: 'Admin', description: 'Admin moderation tools' },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
