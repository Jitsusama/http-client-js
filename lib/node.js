const got = require("got");
const { BaseClient } = require("./base.js");
const errors = require("./errors.js");

/** An HTTP client backed by got. */
class Client extends BaseClient {
  /**
   * Create an HTTP client.
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
    super(options);
    this._client = got.extend({
      prefixUrl: this.baseUri,
      headers: { "User-Agent": this.userAgent },
      hooks: {
        beforeRequest: [this._logRequests.bind(this)],
        afterResponse: [this._logResponses.bind(this)],
      },
      retry: this.retry,
      timeout: this.timeout,
    });
  }

  /**
   * @param {string} method - request method
   * @param {string} path - request path
   * @param {object} [query] - query parameters
   * @param {object} [body] - JSON encoded request body
   * @returns {Promise<any>}
   */
  async _do(method, path, query, body) {
    let text;
    try {
      text = await this._client(path, {
        method: /** @type got.Method */ method,
        searchParams: query,
        json: body,
      }).text();
    } catch (error) {
      throw this._translateError(error);
    }

    return text ? this._parseJson(text) : {};
  }

  /**
   * @param {got.NormalizedOptions} options
   * @returns {void | Promise<void>}
   */
  _logRequests(options) {
    this.log.trace(
      {
        baseUri: this._extractOrigin({ options }),
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
   * @param {got.Response} response
   * @returns {got.Response}
   */
  _logResponses(response) {
    this.log.trace(
      {
        attempts: response.retryCount + 1,
        baseUri: this._extractOrigin(response.request),
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
   * @param {Error|RequestError} error
   * @returns {Error|ClientError}
   */
  _translateError(error) {
    const statusCode = error?.response?.statusCode;
    const baseUri = this._extractOrigin(error?.request);
    const reason = this._extractErrorMessage(error);

    if (error instanceof got.HTTPError) {
      const error = this._translateStatusCode(statusCode);
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
   * @param {Error|RequestError} error
   * @returns {string}
   */
  _extractErrorMessage(error) {
    try {
      const json = error?.response?.body;
      const responseData = this._parseJson(json);
      return responseData?.errorMessage || error?.message;
    } catch {
      return error?.message;
    }
  }

  _parseJson(json) {
    try {
      return super._parseJson(json);
    } catch (error) {
      const baseUri = this.baseUri;
      const reason = error.message;
      this.log.error({ baseUri, reason }, "corrupt JSON response");
      throw error;
    }
  }
}

module.exports = { Client, ...errors };
