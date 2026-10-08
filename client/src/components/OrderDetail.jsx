import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Which buttons to show. The server still checks every request (Q7).
const ACTIONS = {
  distributor: {
    Placed: ['Cancelled'],
    PendingApproval: ['Cancelled'],
    Confirmed: ['Cancelled'],
  },
  manager: {
    PendingApproval: ['Confirmed', 'Rejected'],
    Confirmed: ['Dispatched'],
    Dispatched: ['Delivered'],
  },
};

const LABELS = {
  Cancelled: 'Cancel order',
  Confirmed: 'Approve',
  Rejected: 'Reject',
  Dispatched: 'Mark dispatched',
  Delivered: 'Mark delivered',
};

export default function OrderDetail({ user, orderId, onChanged, onBack }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(user, `/orders/${orderId}`)
      .then(setOrder)
      .catch((err) => setError(err.message));
  }, []);

  async function changeStatus(newStatus) {
    setError('');
    try {
      const updated = await api(user, `/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      setOrder(updated);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!order) return <p className={error ? 'error' : ''}>{error || 'Loading...'}</p>;

  const actions = ACTIONS[user.role][order.status] || [];

  return (
    <section>
      <button onClick={onBack}>Back</button>
      <h2>Order #{order.id} - {order.status}</h2>
      <p>Distributor: {order.distributor_name}</p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Quantity</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.product_id}>
              <td>{item.sku}</td>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit_price.toFixed(2)}</td>
              <td>{item.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        Subtotal: {order.subtotal.toFixed(2)}<br />
        Discount ({order.discount_pct}%): -{order.discount_amount.toFixed(2)}<br />
        <b>Total: {order.total.toFixed(2)}</b>
      </p>

      {actions.map((s) => (
        <button key={s} onClick={() => changeStatus(s)}>{LABELS[s]}</button>
      ))}
      {error && <p className="error">{error}</p>}

      <h3>Event log</h3>
      <table>
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>By</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {order.events.map((e, i) => (
            <tr key={i}>
              <td>{e.from_status || '-'}</td>
              <td>{e.to_status}</td>
              <td>{e.actor_type}{e.actor_id ? ` #${e.actor_id}` : ''}</td>
              <td>{new Date(e.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}