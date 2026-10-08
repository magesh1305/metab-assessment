import * as userService from '../services/userService.js';

export async function getUsers(req, res) {
    const users = await userService.listUsers();
    res.json(users);
}

export async function getMe(req, res) {
    if (req.user.role !== 'distributor') {
        return res.json(req.user);
    }
    const summary = await userService.getDistributorSummary(req.user.id);
    res.json({ role: 'distributor', ...summary });
}