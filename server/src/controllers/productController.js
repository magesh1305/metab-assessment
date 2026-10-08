import * as productService from '../services/productService.js';

export async function getProducts(req, res) {
    const products = await productService.listProducts();
    res.json(products);
}