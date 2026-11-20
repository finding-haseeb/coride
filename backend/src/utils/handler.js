/** Wraps an async route: returns { success, data } or a 400 with the error message. */
export const handle = (fn, status = 200) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.status(status).json({ success: true, data: data ?? null });
  } catch (error) {
    const code = error.status || 400;
    res.status(code).json({ success: false, message: error.message });
  }
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
