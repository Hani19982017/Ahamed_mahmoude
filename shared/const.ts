export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * User roles
 */
export const USER_ROLES = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  WORKER: "worker",
  USER: "user",
} as const;

/**
 * Move statuses
 */
export const MOVE_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

/**
 * Payment statuses
 */
export const PAYMENT_STATUSES = {
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
} as const;

/**
 * Task statuses
 */
export const TASK_STATUSES = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
