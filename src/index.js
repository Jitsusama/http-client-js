const { URL } = require("url");
const got = require("got");
const errors = require("./errors.js");

class Client {
  /**
   * Create an HTTP client.
   * @param {object} [options] -
   *   configuration options
   * @param {string} [options.baseUri] -
   *   base-URL for all requests
   * @param {string} [options.userAgent] -
   *   value of User-Agent header
   * @param {number} [options.requestTimeout=30000] -
   *   time to wait for requests to send
   * @param {number} [options.responseTimeout=30000] -
   *   time to wait for response to arrive
   * @param {number} [options.retry=2] -
   *   amount of retries to attempt in case of failure
   * @param {{error: function, trace: function}} [options.logger] -
   *   used to log messages
   */
  constructor(options) {
    const {
      baseUri = "",
      requestTimeout = 30_000,
      responseTimeout = 30_000,
      retry = 2,
      userAgent = "http-client-js",
      logger = { error: () => {}, trace: () => {} },
    } = options || {};

    this.client = got.extend({
      prefixUrl: baseUri,
      headers: { "User-Agent": userAgent },
      hooks: {
        beforeRequest: [this.logRequestAttempts.bind(this)],
        afterResponse: [this.logResponses.bind(this)],
      },
      retry,
      timeout: { request: requestTimeout, response: responseTimeout },
    });
    this.logger = logger;
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
      throw translateError(this.logger, error);
    }

    return text ? parseJson(this.logger, text, baseUri) : {};
  }

  /**
   * @param {got.NormalizedOptions} options
   * @returns {void | Promise<void>}
   */
  logRequestAttempts(options) {
    this.logger.trace(
      {
        baseUri: getBaseUri(options.prefixUrl),
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
  logResponses(response) {
    this.logger.trace(
      {
        attempts: response.retryCount + 1,
        baseUri: getBaseUri(response.request.options.prefixUrl),
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers,
        body: response.body || undefined,
      },
      "received response"
    );

    return response;
  }
}

module.exports = { Client };

const translateError = (log, error) => {
  const statusCode = error?.response?.statusCode;
  const baseUri = getBaseUri(error?.request?.options?.prefixUrl);
  const reason = extractErrorMessage(error, baseUri);

  if (error instanceof got.HTTPError)
    switch (statusCode) {
      case 400:
        log.error({ baseUri, reason }, "request was rejected");
        return new errors.InvalidRequest();
      case 404:
        log.error({ baseUri, reason }, "resource does not exist");
        return new errors.NotFound();
      case 409:
        log.error({ baseUri, reason }, "state conflict");
        return new errors.Conflict();
      case 502:
        log.error({ baseUri, reason }, "remote failure");
        return new errors.Failure();
      case 504:
        log.error({ baseUri, reason }, "remote timeout");
        return new errors.Timeout();
      default:
        log.error({ baseUri, statusCode }, "unexpected HTTP status code");
        return new errors.Failure();
    }
  if (error instanceof got.RequestError) {
    log.error({ baseUri, reason }, "request timed out");
    return new errors.Timeout();
  }

  log.error({ baseUri, reason }, "unexpected request error");
  return error;
};

const extractErrorMessage = (error, baseUri) => {
  try {
    const json = error?.response?.body;
    const responseData = parseJson(json, baseUri);
    return responseData?.errorMessage || error?.message;
  } catch {
    return error?.message;
  }
};

const parseJson = (log, json, baseUri) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    const reason = error.message;
    log.error({ baseUri, reason }, "corrupt JSON response");
    throw new errors.InvalidResponse();
  }
};

const getBaseUri = (prefixUrl) => {
  try {
    return new URL(prefixUrl).origin;
  } catch {
    return prefixUrl;
  }
};
