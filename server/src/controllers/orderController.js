import * as orderService from '../services/orderService.js';
import { httpError } from '../utils/httpError.js';

export async function createOrder(req, res) {
    if (req.user.role !== 'distributor') {
        throw httpError(403, 'Only distributors can place orders');
    }
    const key = req.header('Idempotency-Key');
    const { orderId, created } = await orderService.placeOrder(req.user.id, req.body?.items, key);
    const order = await orderService.getOrder(req.user, orderId);
    res.status(created ? 201 : 200).json(order);
}

export async function getOrders(req, res) {
    const orders = await orderService.listOrders(req.user, req.query.status);
    res.json(orders);
}

export async function getOrderById(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        throw httpError(400, 'Invalid order id');
    }
    const order = await orderService.getOrder(req.user, id);
    res.json(order);
}

export async function updateStatus(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        throw httpError(400, 'Invalid order id');
    }
    const status = req.body?.status;
    if (!status) {
        throw httpError(400, 'status is required');
    }
    await orderService.transitionOrder(req.user, id, status);
    const order = await orderService.getOrder(req.user, id);
    res.json(order);
}