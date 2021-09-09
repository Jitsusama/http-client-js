const nock = require("nock");
const http = require("./browser.js");

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

    await expect(promise).rejects.toThrowError(http.InvalidResponse);
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
      .matchHeader("content-type", /application\/x-www-form-urlencoded/)
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
      .matchHeader("content-type", /application\/x-www-form-urlencoded/)
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
      .matchHeader("content-type", /application\/x-www-form-urlencoded/)
      .reply(200, output);

    const client = new http.Client({ baseUri });
    const promise = client.post("path", input);

    await expect(promise).rejects.toThrowError(http.InvalidResponse);
  }
);

test.each([
  ["get", 400, "abc", http.InvalidRequest],
  ["get", 401, '{"errorMessage": "message"}', http.Unauthorized],
  ["get", 403, "", http.Forbidden],
  ["get", 404, '{"a":', http.NotFound],
  ["get", 409, '{"b"}', http.Conflict],
  ["get", 502, '{"a":"b" "c":"d"}', http.Failure],
  ["get", 504, "{", http.Timeout],
  ["get", 600, undefined, http.Failure],
  ["post", 400, "abc", http.InvalidRequest],
  ["post", 401, '{"errorMessage": "message"}', http.Unauthorized],
  ["post", 403, "", http.Forbidden],
  ["post", 404, '{"a":', http.NotFound],
  ["post", 409, '{"b"}', http.Conflict],
  ["post", 502, '{"a":"b" "c":"d"}', http.Failure],
  ["post", 504, "{", http.Timeout],
  ["post", 600, undefined, http.Failure],
])("maps %s %d status code to error", async (method, code, body, error) => {
  nock("http://host")[method]("/path").reply(code, body);

  const client = new http.Client({
    baseUri: "http://host",
    responseTimeout: 10_000,
  });
  const promise = client[method]("path");

  await expect(promise).rejects.toThrowError(error);
});

test.each(["get", "post"])(
  "handles remote DNS resolution failures during %s",
  async (method) => {
    const client = new http.Client({
      baseUri: "http://invalid-host.edu",
      responseTimeout: 1000,
    });
    const promise = client[method]("path");

    await expect(promise).rejects.toThrow(http.Timeout);
  }
);

test.each(["get", "post"])(
  "handles remote connection timeout during %s",
  async (method) => {
    // Given
    nock("http://host")[method]("/path").delayConnection(10).reply(204);

    // When
    const client = new http.Client({
      baseUri: "http://host",
      responseTimeout: 1,
    });
    const promise = client[method]("path");

    // Then
    await expect(promise).rejects.toThrow(http.Timeout);
  }
);

test.each(["get", "post"])(
  "handles remote read timeout during %s",
  async (method) => {
    // Given
    nock("http://host")[method]("/path").delayBody(10).reply(204);

    // When
    const client = new http.Client({
      baseUri: "http://host",
      responseTimeout: 1,
    });
    const promise = client[method]("path");

    // Then
    await expect(promise).rejects.toThrow(http.Timeout);
  }
);

afterEach(() => {
  nock.cleanAll();
});
