import * as userService from '../services/userService.js';

export async function getUsers(req, res) {
    const users = await userService.listUsers();
    res.json(users);
}