import { createMiddleware } from "@tanstack/react-start";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Auth middleware for server functions — resolves the caller's verified user id. */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { auth } = await import("./server");
  const request = getRequest();
  const session = request ? await auth.api.getSession({ headers: request.headers }) : null;
  if (!session?.user) throw new UnauthorizedError();
  return next({ context: { userId: session.user.id } });
});
