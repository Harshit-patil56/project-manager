import { Router, type IRouter } from "express";
import healthRouter from "./health";
import webhookRouter from "./webhook";
import usersRouter from "./users";
import workspacesRouter from "./workspaces";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import commentsRouter from "./comments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(webhookRouter);
router.use(usersRouter);
router.use(workspacesRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(commentsRouter);

export default router;
