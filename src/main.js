const logging = require("@jitsusama/logging-js");
const got = require("got");
const errors = require("./errors.js");
const shared = require("./shared.js");

/** An HTTP client backed by got. */
class Client {
  /**
   * Create an HTTP client.
   * @constructor
   * @param {object} [options] - configuration options
   * @param {string} [options.baseUri] - base-URL for all requests
   * @param {string} [options.userAgent="http-client"] - User-Agent header
   * @param {number} [options.requestTimeout=30000] - time to wait for requests
   * @param {number} [options.responseTimeout=30000] - time to wait for response
   * @param {number} [options.retry=2] - amount of retries to attempt
   * @param {object} [options.logs] - logging configuration
   * @param {string} [options.logs.layer="http-client"] - layer to log as
   * @param {string} [options.logs.level="silent"] - logging level
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
    const { layer = "http-client", level = "silent" } = logs || {};

    this.client = got.extend({
      prefixUrl: baseUri,
      headers: { "User-Agent": userAgent },
      hooks: {
        beforeRequest: [this._logRequests.bind(this)],
        afterResponse: [this._logResponses.bind(this)],
      },
      retry,
      timeout: { request: requestTimeout, response: responseTimeout },
    });
    this.log = logging.getLogger(layer, level);
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
   * Perform an HTTP PUT request and return its response body.
   * @method
   * @param {string} path - request path
   * @param {object} body - JSON encoded request body
   * @returns {Promise<any>}
   */
  async put(path, body) {
    return this._do("put", path, undefined, body);
  }

  /**
   * Perform an HTTP request and return its response body.
   * @private
   * @param {got.Method} method - request method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @param {object} [body] - JSON encoded request body
   * @returns {Promise<any>}
   */
  async _do(method, path, query, body) {
    const baseUri = this.client.defaults.options.prefixUrl;

    let text;
    try {
      text = await this.client(path, {
        method,
        searchParams: query,
        json: body,
      }).text();
    } catch (error) {
      throw this._translateError(error);
    }

    return text ? shared.parseJson(this.log, baseUri, text) : {};
  }

  /**
   * @private
   * @param {got.NormalizedOptions} options
   * @returns {void | Promise<void>}
   */
  _logRequests(options) {
    this.log.trace(
      {
        baseUri: shared.extractOrigin({ options }),
        method: options.method,
        path: options.url.pathname,
        query: options.searchParams?.toString() || undefined,
        headers: options.headers,
        body: options.body || undefined,
      },
      "sending request"
    );
  }

  /**
   * @private
   * @param {got.Response} response
   * @returns {got.Response}
   */
  _logResponses(response) {
    this.log.trace(
      {
        attempts: response.retryCount + 1,
        baseUri: shared.extractOrigin(response.request),
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers,
        body: response.body || undefined,
      },
      "received response"
    );

    return response;
  }

  /**
   * @private
   * @param {Error|RequestError} error
   * @returns {Error|ClientError}
   */
  _translateError(error) {
    const statusCode = error?.response?.statusCode;
    const baseUri = shared.extractOrigin(error?.request);
    const reason = this._extractErrorMessage(baseUri, error);

    if (error instanceof got.HTTPError) {
      const error = shared.translateStatusCode(statusCode);
      this.log.error({ baseUri, reason }, error.message);
      return error;
    }
    if (error instanceof got.RequestError) {
      this.log.error({ baseUri, reason }, "request timed out");
      return new errors.Timeout();
    }

    this.log.error({ baseUri, reason }, "unexpected request error");
    return error;
  }

  /**
   * @private
   * @param {string} baseUri
   * @param {Error|RequestError} error
   * @returns {string}
   */
  _extractErrorMessage(baseUri, error) {
    try {
      const json = error?.response?.body;
      const responseData = shared.parseJson(this.log, baseUri, json);
      return responseData?.errorMessage || error?.message;
    } catch {
      return error?.message;
    }
  }
}

module.exports = { Client, ...errors };
