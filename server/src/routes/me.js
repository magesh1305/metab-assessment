import { Router } from 'express';
import { getMe } from '../controllers/userController.js';

const router = Router();

router.get('/', getMe);

export default router;