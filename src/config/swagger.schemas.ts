export const errorResponseSchema = {
  '4xx': {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
      details: { type: 'object', additionalProperties: true }
    }
  },
  '5xx': {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' }
    }
  }
};
