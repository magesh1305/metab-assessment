import { findUser } from '../services/userService.js';

export default async function currentUser(req, res, next) {
    const role = req.header('x-user-role');
    const id = Number(req.header('x-user-id'));

    if (!['distributor', 'manager'].includes(role) || !Number.isInteger(id)) {
        return res.status(401).json({ error: 'Select a user first' });
    }

    const user = await findUser(role, id);
    if (!user) {
        return res.status(401).json({ error: 'Unknown user' });
    }

    req.user = { role, id, name: user.name };
    next();
}