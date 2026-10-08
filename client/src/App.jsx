import { useEffect, useState } from 'react';
import { api } from './api.js';
import Catalogue from './components/Catalogue.jsx';
import OrderList from './components/OrderList.jsx';
import OrderDetail from './components/OrderDetail.jsx';

export default function App() {
  const [users, setUsers] = useState(null);
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('catalogue');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    api(null, '/users').then(setUsers);
  }, []);

  useEffect(() => {
    if (!user) return;
    api(user, '/me').then(setMe);
  }, [user]);

  function refreshMe() {
    api(user, '/me').then(setMe);
  }

  function switchUser(value) {
    const [role, id] = value.split(':');
    setUser({ role, id: Number(id) });
    setMe(null);
    setView(role === 'distributor' ? 'catalogue' : 'queue');
  }

  function openOrder(id) {
    setSelectedOrderId(id);
    setView('detail');
  }

  return (
    <div className="app">
      <header>
        <h1>Distributor Orders</h1>

        <select value={user ? `${user.role}:${user.id}` : ''} onChange={(e) => switchUser(e.target.value)}>
          <option value="" disabled>Select user</option>
          <optgroup label="Distributors">
            {users?.distributors.map((d) => (
              <option key={d.id} value={`distributor:${d.id}`}>{d.name}</option>
            ))}
          </optgroup>
          <optgroup label="Sales Manager">
            {users?.managers.map((m) => (
              <option key={m.id} value={`manager:${m.id}`}>{m.name}</option>
            ))}
          </optgroup>
        </select>

        {me?.role === 'distributor' && (
          <span className="badge">
            Points (last 90 days): <b>{me.points}</b> · Tier: <b>{me.tier}</b>
          </span>
        )}
      </header>

      {!user ? (
        <p>Select a user to start.</p>
      ) : (
        <main key={`${user.role}:${user.id}`}>
          <nav>
            {user.role === 'distributor' ? (
              <>
                <button onClick={() => setView('catalogue')}>Catalogue</button>
                <button onClick={() => setView('orders')}>My orders</button>
              </>
            ) : (
              <>
                <button onClick={() => setView('queue')}>Approval queue</button>
                <button onClick={() => setView('orders')}>All orders</button>
                <button onClick={() => setView('catalogue')}>Catalogue</button>
              </>
            )}
          </nav>

          {view === 'catalogue' && (
            <Catalogue
              user={user}
              onOrderPlaced={(order) => {
                refreshMe();
                openOrder(order.id);
              }}
            />
          )}
          {view === 'orders' && <OrderList user={user} onOpen={openOrder} />}
          {view === 'queue' && <OrderList user={user} status="PendingApproval" onOpen={openOrder} />}
          {view === 'detail' && (
            <OrderDetail
              user={user}
              orderId={selectedOrderId}
              onChanged={refreshMe}
              onBack={() => setView('orders')}
            />
          )}
        </main>
      )}
    </div>
  );
}