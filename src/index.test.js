const nock = require("nock");
const errors = require("./errors.js");
const http = require("./index.js");

test.each([
  ["https://1.2.3.4/path", "resource", { a: "b" }],
  ["http://host.com:1234", "sub/path", {}],
])(
  "performs GET request without query parameters present",
  async (baseUri, path, output) => {
    nock(baseUri).get(`/${path}`).reply(200, output);

    const client = new http.Client({ baseUri });
    const response = await client.get(path);

    expect(response).toEqual(output);
  }
);

test.each([
  ["http://2.3.4.5/a/path", "sub/path", { a: "b" }, {}],
  ["https://place.ca:2345", "resource", { c: "d", e: "f" }, { c: "d" }],
])(
  "performs GET request with query parameters present",
  async (baseUri, path, query, output) => {
    nock(baseUri).get(`/${path}`).query(query).reply(200, output);

    const client = new http.Client({ baseUri });
    const response = await client.get(path, query);

    expect(response).toEqual(output);
  }
);

test.each(["[", "{", '{key: "value"}', "[{]", "<a/>", "hello", '{"a"}'])(
  "complains for GET request with non-json response",
  async (output) => {
    const baseUri = "http://host.com";
    nock(baseUri).get(`/path`).reply(200, output);

    const client = new http.Client({ baseUri });
    const promise = client.get("path");

    await expect(promise).rejects.toThrowError(errors.InvalidResponse);
  }
);

test.each([
  ["http://host.com:1234", "sub/path", { g: "h" }, { k: "l" }],
  ["https://1.2.3.4/path", "resource", { i: "j", l: "m" }, {}],
])(
  "performs POST request that replies with a body",
  async (baseUri, path, input, output) => {
    nock(baseUri)
      .post(`/${path}`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(200, output);

    const client = new http.Client({ baseUri });
    const response = await client.post(path, input);

    expect(response).toEqual(output);
  }
);

test.each([
  ["http://2.3.4.5/a/path", "sub/path", { n: "o", p: "p" }],
  ["https://place.ca:2345", "resource", { q: "r" }],
])(
  "performs POST request that replies with no body",
  async (baseUri, path, input) => {
    nock(baseUri)
      .post(`/${path}`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(204);

    const client = new http.Client({ baseUri });
    const response = await client.post(path, input);

    expect(response).toBeEmpty();
  }
);

test.each(["[", "{", '{key: "value"}', "[{]", "<a/>", "hello", '{"a"}'])(
  "complains for POST request with non-json response",
  async (output) => {
    const baseUri = "http://host.com";
    const input = { some: "value" };

    nock(baseUri)
      .post(`/path`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(200, output);

    const client = new http.Client({ baseUri });
    const promise = client.post("path", input);

    await expect(promise).rejects.toThrowError(errors.InvalidResponse);
  }
);

test.each([
  ["http://host.com:1234", "sub/path", { g: "h" }, { k: "l" }],
  ["https://1.2.3.4/path", "resource", { i: "j", l: "m" }, {}],
])(
  "performs PUT request that replies with a body",
  async (baseUri, path, input, output) => {
    nock(baseUri)
      .put(`/${path}`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(200, output);

    const client = new http.Client({ baseUri });
    const response = await client.put(path, input);

    expect(response).toEqual(output);
  }
);

test.each([
  ["http://2.3.4.5/a/path", "sub/path", { n: "o", p: "p" }],
  ["https://place.ca:2345", "resource", { q: "r" }],
])(
  "performs PUT request that replies with no body",
  async (baseUri, path, input) => {
    nock(baseUri)
      .put(`/${path}`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(204);

    const client = new http.Client({ baseUri });
    const response = await client.put(path, input);

    expect(response).toBeEmpty();
  }
);

test.each(["[", "{", '{key: "value"}', "[{]", "<a/>", "hello", '{"a"}'])(
  "complains for PUT request with non-json response",
  async (output) => {
    const baseUri = "http://host.com";
    const input = { some: "value" };

    nock(baseUri)
      .put(`/path`, input)
      .matchHeader("content-type", /application\/json/)
      .reply(200, output);

    const client = new http.Client({ baseUri });
    const promise = client.put("path", input);

    await expect(promise).rejects.toThrowError(errors.InvalidResponse);
  }
);

test.each([
  ["get", 400, "abc", errors.InvalidRequest],
  ["get", 404, '{"errorMessage": "message"}', errors.NotFound],
  ["get", 409, "", errors.Conflict],
  ["get", 502, '{"a":"b" "c":"d"}', errors.Failure],
  ["get", 504, '{"a":', errors.Timeout],
  ["get", 600, "{", errors.Failure],
  ["post", 400, "{[}]", errors.InvalidRequest],
  ["post", 404, '{"a"}', errors.NotFound],
  ["post", 409, '{"errorMessage": "hello"}', errors.Conflict],
  ["post", 502, undefined, errors.Failure],
  ["post", 504, '{"errorMessage": "message"}', errors.Timeout],
  ["post", 600, "abc", errors.Failure],
  ["put", 400, '{"errorMessage": "message"}', errors.InvalidRequest],
  ["put", 404, '{"a"}', errors.NotFound],
  ["put", 409, '{"errorMessage}', errors.Conflict],
  ["put", 502, undefined, errors.Failure],
  ["put", 504, "abc", errors.Timeout],
  ["put", 600, "", errors.Failure],
])("maps %s %d status code to error", async (method, code, body, error) => {
  nock("http://host")[method]("/path").reply(code, body);

  const client = new http.Client({
    baseUri: "http://host",
    requestTimeout: 10_000,
    responseTimeout: 10_000,
    retry: 0,
  });
  const promise = client[method]("path");

  await expect(promise).rejects.toThrowError(error);
});

test.each(["get", "post", "put"])(
  "handles remote DNS resolution failures during %s",
  async (method) => {
    const client = new http.Client({
      baseUri: "http://invalid-host.edu",
      requestTimeout: 1000,
      responseTimeout: 1000,
      retry: 0,
    });
    const promise = client[method]("path");

    await expect(promise).rejects.toThrow(errors.Timeout);
  }
);

test.each(["get", "post", "put"])(
  "handles remote connection timeout during %s",
  async (method) => {
    // Given
    nock("http://host")[method]("/path").delayConnection(10).reply(204);

    // When
    const client = new http.Client({
      baseUri: "http://host",
      requestTimeout: 1,
      responseTimeout: 10_000,
      retry: 0,
    });
    const promise = client[method]("path");

    // Then
    await expect(promise).rejects.toThrow(errors.Timeout);
  }
);

test.each(["get", "post", "put"])(
  "handles remote read timeout during %s",
  async (method) => {
    // Given
    nock("http://host")[method]("/path").delayBody(10).reply(204);

    // When
    const client = new http.Client({
      baseUri: "http://host",
      requestTimeout: 10_000,
      responseTimeout: 1,
      retry: 0,
    });
    const promise = client[method]("path");

    // Then
    await expect(promise).rejects.toThrow(errors.Timeout);
  }
);

afterEach(() => {
  nock.cleanAll();
});
