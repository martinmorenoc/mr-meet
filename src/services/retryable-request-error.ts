// Marks a failure that is worth another attempt: a timeout, a dropped
// connection, a rate limit, or a backend hiccup on Google's side.
export default class RetryableRequestError extends Error {}
