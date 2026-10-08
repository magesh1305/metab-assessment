import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function OrderList({ user, status, onOpen }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  function loadOrders() {
    const query = status ? `?status=${status}` : '';
    api(user, `/orders${query}`).then(setOrders);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function changeStatus(orderId, newStatus) {
    setError('');
    try {
      await api(user, `/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  const isManager = user.role === 'manager';
  const isQueue = status === 'PendingApproval';
  const title = isQueue ? 'Approval queue' : isManager ? 'All orders' : 'My orders';

  return (
    <section>
      <h2>{title}</h2>
      {error && <p className="error">{error}</p>}

      {orders.length === 0 ? (
        <p>No orders.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              {isManager && <th>Distributor</th>}
              <th>Status</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Placed at</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                {isManager && <td>{o.distributor_name}</td>}
                <td>{o.status}</td>
                <td>{o.discount_pct}% ({o.discount_amount.toFixed(2)})</td>
                <td>{o.total.toFixed(2)}</td>
                <td>{new Date(o.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => onOpen(o.id)}>View</button>
                  {isQueue && (
                    <>
                      <button onClick={() => changeStatus(o.id, 'Confirmed')}>Approve</button>
                      <button onClick={() => changeStatus(o.id, 'Rejected')}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}