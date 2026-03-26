import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dealFilesRouter from "./dealFiles";
import docTypesRouter from "./docTypes";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dealFilesRouter);
router.use(docTypesRouter);
router.use(uploadRouter);

export default router;
