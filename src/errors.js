/** A generic HTTP client error. */
class ClientError extends Error {
  name = this.constructor.name;
}

/** The requested resource's state conflicts with the requested operation. */
class Conflict extends ClientError {
  name = this.constructor.name;
}

/** The remote server stated that our request was malformed. */
class InvalidRequest extends ClientError {
  name = this.constructor.name;
}

/** The requested resource could not be found. */
class NotFound extends ClientError {
  name = this.constructor.name;
}

/** The remote server encountered an error. */
class Failure extends ClientError {
  name = this.constructor.name;
}

/** Timed out while trying to obtain a reply from the remote server. */
class Timeout extends ClientError {
  name = this.constructor.name;
}

/** Remote server returned a response that we cannot parse. */
class InvalidResponse extends ClientError {
  name = this.constructor.name;
}

module.exports = {
  ClientError,
  Conflict,
  InvalidRequest,
  InvalidResponse,
  NotFound,
  Failure,
  Timeout,
};
