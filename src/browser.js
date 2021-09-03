const errors = require("./errors.js");

/** An HTTP client backed by fetch. */
class Client {
  /**
   * Create an HTTP client.
   * @constructor
   * @param {object} [options] - configuration options
   * @param {string} [options.baseUri] - base-URL for all requests
   * @param {number} [options.responseTimeout=30000] - time to wait for response
   * @param {object} [options.logs] - logging configuration
   * @param {string} [options.logs.layer="http-client"] - layer to log as
   * @param {string} [options.logs.level="silent"] - logging level
   */
  constructor(options) {
    const { baseUri = "", responseTimeout = 30_000, logs } = options || {};
    const { layer = "http-client", level = "silent" } = logs || {};
    this.baseUri = baseUri;
    this.timeout = responseTimeout;
  }

  /**
   * Perform an HTTP GET request and return its response body.
   * @method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @returns {Promise<any>}
   */
  async get(path, query) {
    return this._do("get", path, query);
  }

  /**
   * Perform an HTTP POST request and return its response body.
   * @method
   * @param {string} path - request path
   * @param {object} body - JSON encoded request body
   * @returns {Promise<any>}
   */
  async post(path, body) {
    return this._do("post", path, undefined, body);
  }

  /**
   * Perform an HTTP request and return its response body.
   * @private
   * @param {string} method - request method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @param {object} [body] - JSON encoded request body
   * @returns {Promise<any>}
   */
  async _do(method, path, query, body) {
    let uri = `${this.baseUri}/${path}`;
    if (query) uri += `?${new URLSearchParams(query)}`;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.timeout);

    const options = { method, signal: controller.signal };
    if (body) options.body = new URLSearchParams(body);

    const response = await fetch(uri, options);
    return await response.json();
  }
}

module.exports = { Client, ...errors };
