import { Router } from 'express';
import authRouter from './auth';
import appointmentsRouter from './appointments';
import inventoryRouter from './inventory';
import injectorsRouter from './injectors';

const router = Router();

router.use('/auth', authRouter);
router.use('/appointments', appointmentsRouter);
router.use('/inventory', inventoryRouter);
router.use('/injectors', injectorsRouter);

export default router;
