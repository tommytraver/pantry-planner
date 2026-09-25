import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

function NutritionInfo({ info }) {
  if (!info) return null;
  if (info.status === "loading") return <p className="nutrition">Loading...</p>;
  if (info.status === "error")
    return <p className="nutrition error">Couldn't load nutrition.</p>;
  if (info.status === "none") return <p className="nutrition">No match found.</p>;

  const { description, calories, protein_g, carbs_g, fat_g } = info.data;
  const fmt = (v) => (v == null ? "?" : Math.round(v));

  return (
    <p className="nutrition">
      {description}, per 100g: {fmt(calories)} kcal · {fmt(protein_g)}g protein ·{" "}
      {fmt(carbs_g)}g carbs · {fmt(fat_g)}g fat
    </p>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [nutrition, setNutrition] = useState({});

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

  async function loadNutrition(item) {
    setNutrition((prev) => ({ ...prev, [item.id]: { status: "loading" } }));
    try {
      const res = await fetch(
        `${API_URL}/nutrition?query=${encodeURIComponent(item.name)}`
      );
      if (!res.ok) throw new Error();
      const results = await res.json();
      setNutrition((prev) => ({
        ...prev,
        [item.id]: results.length
          ? { status: "done", data: results[0] }
          : { status: "none" },
      }));
    } catch {
      setNutrition((prev) => ({ ...prev, [item.id]: { status: "error" } }));
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
              <div className="item-row">
                <span>
                  {item.name} ({item.quantity} {item.unit})
                </span>
                <div className="item-actions">
                  <button onClick={() => loadNutrition(item)}>Nutrition</button>
                  <button onClick={() => deleteItem(item.id)}>Delete</button>
                </div>
              </div>
              <NutritionInfo info={nutrition[item.id]} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;