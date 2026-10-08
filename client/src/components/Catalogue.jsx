import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Catalogue({ user, onOrderPlaced }) {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  function loadProducts() {
    api(user, '/products').then(setProducts);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function setQuantity(productId, value) {
    setQuantities({ ...quantities, [productId]: value });
  }

  async function placeOrder() {
    const items = Object.entries(quantities)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setError('Enter a quantity for at least one product');
      return;
    }

    setError('');
    setPlacing(true);
    try {
      const order = await api(user, '/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ items }),
      });
      setQuantities({});
      setIdempotencyKey(crypto.randomUUID());
      onOrderPlaced(order);
    } catch (err) {
      setError(err.message);
      loadProducts();
    } finally {
      setPlacing(false);
    }
  }

  const isDistributor = user.role === 'distributor';

  return (
    <section>
      <h2>Catalogue</h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Unit price</th>
            <th>Available</th>
            {isDistributor && <th>Quantity</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.unit_price.toFixed(2)}</td>
              <td>{p.available === 0 ? 'Out of stock' : p.available}</td>
              {isDistributor && (
                <td>
                  <input
                    type="number"
                    min="0"
                    disabled={p.available === 0}
                    value={quantities[p.id] || ''}
                    onChange={(e) => setQuantity(p.id, e.target.value)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isDistributor && (
        <>
          {error && <p className="error">{error}</p>}
          <button onClick={placeOrder} disabled={placing}>
            {placing ? 'Placing...' : 'Place order'}
          </button>
        </>
      )}
    </section>
  );
}