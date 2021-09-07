const errors = require("./errors.js");

/**
 * Extract request origin.
 * @param {Request|object} request
 * @returns {string}
 */
const extractOrigin = (request) => {
  const prefixUrl = request?.options?.prefixUrl || request?.url;
  try {
    const url = new (URL || require("url").URL)(prefixUrl);
    return url.origin();
  } catch {
    return prefixUrl;
  }
};

/**
 * @param {SimpleLogger} log
 * @param {string} baseUri
 * @param {string} json
 * @returns {any}
 */
const parseJson = (log, baseUri, json) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    const reason = error.message;
    log.error({ baseUri, reason }, "corrupt JSON response");
    throw new errors.InvalidResponse();
  }
};

/**
 * @param {number} statusCode
 * @returns {ClientError}
 */
const translateStatusCode = (statusCode) => {
  switch (statusCode) {
    case 400:
      return new errors.InvalidRequest("request was rejected");
    case 401:
      return new errors.Unauthorized("invalid credentials");
    case 403:
      return new errors.Forbidden("credentials lack proper authorization");
    case 404:
      return new errors.NotFound("resource does not exist");
    case 409:
      return new errors.Conflict("state conflict");
    case 502:
      return new errors.Failure("remote failure");
    case 504:
      return new errors.Timeout("remote timeout");
    default:
      return new errors.Failure(`unexpected status code ${statusCode}`);
  }
};

module.exports = { extractOrigin, parseJson, translateStatusCode };
