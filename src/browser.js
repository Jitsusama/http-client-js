const errors = require("./errors.js");
const shared = require("./shared.js");

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
    this.log = /** @type {SimpleLogger} */ {
      error: (template, parameters) => {
        const date = new Date().toISOString().replace(/[:-]/g, "");
        if (level !== "silent")
          console.error(
            `%c${date}%c ERROR%c [${layer}] ${template}`,
            "font-weight:normal",
            "font-weight:bold;color:red",
            "font-style:inherit;font-weight:normal",
            ...parameters
          );
      },
    };
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
   * @private
   * @param {string} method - request method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @param {object} [body] - JSON encoded request body
   * @returns {Promise<any>}
   */
  async _do(method, path, query, body) {
    let uri = `${this.baseUri}/${path}`;
    const controller = new AbortController();
    const options = { method, signal: controller.signal };
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    if (query) uri += `?${new URLSearchParams(query)}`;
    if (body) options.body = new URLSearchParams(body);

    let response, text;
    try {
      response = await fetch(uri, options);
      text = await response.text();
    } catch (error) {
      this.log.error(
        { baseUri: this.baseUri, reason: error.message },
        "request failed"
      );
      throw new errors.Timeout();
    } finally {
      clearTimeout(timeout);
    }

    if (!response?.ok) throw shared.translateStatusCode(response.status);
    else return text ? shared.parseJson(this.log, this.baseUri, text) : {};
  }
}

module.exports = { Client, ...errors };
