require("jest-extended");
const { default: AbortController } = require("abort-controller");
const { default: fetch, Request, Response } = require("node-fetch");

// NOTE: This replaces the fetch global function in Node.JS so that while
// running our tests via Jest, we'll be able to assert that remote API calls
// are done correctly.
global.fetch = fetch;
global.Request = Request;
global.Response = Response;
global.AbortController = AbortController;
