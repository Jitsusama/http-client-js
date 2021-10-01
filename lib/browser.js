const { BaseClient } = require("./base.js");
const errors = require("./errors.js");

/** An HTTP client backed by fetch. */
class Client extends BaseClient {
  /**
   * Create an HTTP client.
   * @param {object} [options] - configuration options
   * @param {string} [options.baseUri] - base-URL for all requests
   * @param {number} [options.responseTimeout=30000] - time to wait for response
   * @param {object} [options.logs] - logging configuration
   * @param {string} [options.logs.layer="http-client"] - layer to log as
   */
  constructor(options) {
    super(options);
    this._abortAfter = this.timeout.response || this.timeout.request;
  }

  /**
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
    const timeout = setTimeout(() => controller.abort(), this._abortAfter);

    if (query) uri += `?${new URLSearchParams(query)}`;
    if (body) options.body = new URLSearchParams(body);

    let response, text;
    try {
      response = await fetch(uri, options);
      text = await response.text();
    } catch {
      this.log.error("request to %s timed out", this.baseUri);
      throw new errors.Timeout();
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = this._translateStatusCode(response.status);
      this.log.error(
        "request to %s failed due to %s",
        this.baseUri || `/${path}`,
        error.message
      );
      throw error;
    } else {
      return text ? this._parseJson(text) : {};
    }
  }

  _parseJson(json) {
    try {
      return super._parseJson(json);
    } catch (error) {
      this.log.error("%s gave a corrupt JSON response", this.baseUri);
      throw error;
    }
  }
}

module.exports = { Client, ...errors };
