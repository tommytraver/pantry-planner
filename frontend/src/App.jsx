import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPantry() {
      try {
        const res = await fetch(`${API_URL}/pantry`);
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        setError("Can't reach the backend. Is it running?");
      }
    }
    loadPantry();
  }, []);

  async function addItem(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/pantry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: Number(quantity), unit }),
      });
      if (!res.ok) throw new Error();
      const newItem = await res.json();
      setItems([...items, newItem]);
      setName("");
      setQuantity("");
      setUnit("");
      setError("");
    } catch {
      setError("Couldn't add item. Check that every field is filled in.");
    }
  }

  async function deleteItem(id) {
    try {
      const res = await fetch(`${API_URL}/pantry/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems(items.filter((item) => item.id !== id));
    } catch {
      setError("Couldn't delete item.");
    }
  }

  return (
    <main className="app">
      <h1>Pantry</h1>

      <form className="add-form" onSubmit={addItem}>
        <input
          placeholder="Item (e.g. chicken breast)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          step="any"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <input
          placeholder="Unit (lbs, oz, count)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="empty">Pantry's empty. Add something above.</p>
      ) : (
        <ul className="pantry-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.name} ({item.quantity} {item.unit})
              </span>
              <button onClick={() => deleteItem(item.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
