import { Router } from "express";
import * as ctrl from "./user.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import {
  inviteUserSchema,
  updateUserSchema,
  setPermissionsSchema,
  setScheduleSchema,
  addLeaveSchema,
  recordAttendanceSchema,
} from "./user.validator";

/*
 * User & team routes (spec 4.13). Staff admin gated on the `staff` resource;
 * doctor performance is analytics-adjacent but scoped to the staff record.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

export const userRouter = Router();
userRouter.use(...guard);
userRouter.get("/", authorize("staff", "read"), asyncHandler(ctrl.list));
userRouter.post("/", authorize("staff", "create"), validate({ body: inviteUserSchema }), asyncHandler(ctrl.invite));
userRouter.get("/:id", authorize("staff", "read"), asyncHandler(ctrl.getOne));
userRouter.patch("/:id", authorize("staff", "update"), validate({ body: updateUserSchema }), asyncHandler(ctrl.update));
userRouter.post("/:id/activate", authorize("staff", "update"), asyncHandler(ctrl.activate));
userRouter.post("/:id/deactivate", authorize("staff", "update"), asyncHandler(ctrl.deactivate));
userRouter.patch("/:id/permissions", authorize("staff", "update"), validate({ body: setPermissionsSchema }), asyncHandler(ctrl.setPermissions));
userRouter.patch("/:id/schedule", authorize("staff", "update"), validate({ body: setScheduleSchema }), asyncHandler(ctrl.setSchedule));
userRouter.post("/:id/leave", authorize("staff", "update"), validate({ body: addLeaveSchema }), asyncHandler(ctrl.addLeave));
userRouter.get("/:id/performance", authorize("staff", "read"), asyncHandler(ctrl.performance));

export const attendanceRouter = Router();
attendanceRouter.use(...guard);
attendanceRouter.get("/", authorize("staff", "read"), asyncHandler(ctrl.listAttendance));
attendanceRouter.post("/", authorize("staff", "update"), validate({ body: recordAttendanceSchema }), asyncHandler(ctrl.recordAttendance));
