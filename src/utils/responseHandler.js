const success = (res, data, statusCode = 200, meta = {}) => {
  const response = {
    status: 'success',
    data,
    ...meta,
  };

  // Add request ID if available
  if (res.req?.id) {
    response.requestId = res.req.id;
  }

  return res.status(statusCode).json(response);
};

const error = (res, message, statusCode = 400, errors = null) => {
  const response = {
    status: 'fail',
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (res.req?.id) {
    response.requestId = res.req.id;
  }

  return res.status(statusCode).json(response);
};

const paginatedSuccess = (res, data, pagination, statusCode = 200) => {
  return success(res, data, statusCode, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1,
    },
  });
};

module.exports = { success, error, paginatedSuccess };