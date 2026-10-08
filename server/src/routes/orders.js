import { Router } from 'express';
import { createOrder, getOrders, getOrderById, updateStatus } from '../controllers/orderController.js';

const router = Router();

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/:id/status', updateStatus);

export default router;