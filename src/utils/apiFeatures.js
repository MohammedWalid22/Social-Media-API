class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt|ne|in|nin|regex)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate(defaultLimit = 100) {
    const page = Math.max(parseInt(this.queryString.page, 10) || 1, 1);
    const limit = Math.min(
      parseInt(this.queryString.limit, 10) || defaultLimit,
      100 // Max limit
    );
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit, skip };
    return this;
  }

  search(searchableFields = []) {
    if (this.queryString.search && searchableFields.length > 0) {
      const searchRegex = new RegExp(this.queryString.search, 'i');
      const orConditions = searchableFields.map(field => ({
        [field]: searchRegex,
      }));
      this.query = this.query.find({ $or: orConditions });
    }
    return this;
  }

  // Get pagination info for response
  async getPaginationInfo(totalDocs) {
    const { limit, page } = this.pagination || { limit: 10, page: 1 };
    return {
      page,
      limit,
      total: totalDocs,
      pages: Math.ceil(totalDocs / limit),
      hasNext: page * limit < totalDocs,
      hasPrev: page > 1,
    };
  }
}

module.exports = APIFeatures;