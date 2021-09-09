const logging = require("@jitsusama/logging-js");
const errors = require("./errors.js");

class BaseClient {
  /**
   * @param {object} [options] - configuration options
   * @param {string} [options.baseUri] - base-URL for all requests
   * @param {string} [options.userAgent="http-client"] - User-Agent header
   * @param {number} [options.requestTimeout=30000] - time to wait for requests
   * @param {number} [options.responseTimeout=30000] - time to wait for response
   * @param {number} [options.retry=2] - amount of retries to attempt
   * @param {object} [options.logs] - logging configuration
   * @param {string} [options.logs.layer="http-client"] - layer to log as
   */
  constructor(options) {
    const {
      baseUri = "",
      requestTimeout = 30_000,
      responseTimeout = 30_000,
      retry = 2,
      userAgent = "http-client",
      logs,
    } = options || {};
    const { layer = "http-client" } = logs || {};

    this.baseUri = baseUri;
    this.log = logging.getLogger(layer);
    this.retry = retry;
    this.timeout = { request: requestTimeout, response: responseTimeout };
    this.userAgent = userAgent;
  }

  /**
   * Perform an HTTP GET request and return its response body.
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @returns {Promise<any>}
   */
  async get(path, query) {
    return this._do("get", path, query);
  }

  /**
   * Perform an HTTP POST request and return its response body.
   * @param {string} path - request path
   * @param {object} body - JSON encoded request body
   * @returns {Promise<any>}
   */
  async post(path, body) {
    return this._do("post", path, undefined, body);
  }

  /**
   * Perform an HTTP PUT request and return its response body.
   * @param {string} path - request path
   * @param {object} body - JSON encoded request body
   * @returns {Promise<any>}
   */
  async put(path, body) {
    return this._do("put", path, undefined, body);
  }

  /**
   * Perform an HTTP request and return its response body.
   * @param {string} method - request method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @param {object} [body] - JSON encoded request body
   * @returns {Promise<any>}
   */
  // eslint-disable-next-line no-unused-vars
  async _do(method, path, query, body) {}

  /**
   * @param {Request|object} request
   * @returns {string}
   */
  _extractOrigin(request) {
    const prefixUrl = request?.options?.prefixUrl || request?.url;
    try {
      const url = new (URL || require("url").URL)(prefixUrl);
      return url.origin();
    } catch {
      return prefixUrl;
    }
  }

  /**
   * @param {string} json
   * @returns {any}
   */
  _parseJson(json) {
    try {
      return JSON.parse(json);
    } catch {
      throw new errors.InvalidResponse();
    }
  }

  /**
   * @param {number} statusCode
   * @returns {ClientError}
   */
  _translateStatusCode(statusCode) {
    switch (statusCode) {
      case 400:
        return new errors.InvalidRequest();
      case 401:
        return new errors.Unauthorized();
      case 403:
        return new errors.Forbidden();
      case 404:
        return new errors.NotFound();
      case 409:
        return new errors.Conflict();
      case 502:
        return new errors.Failure();
      case 504:
        return new errors.Timeout();
      default:
        return new errors.Failure();
    }
  }
}

module.exports = { BaseClient };
