import { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "./api";

// Must match the Unit list in backend/models.py
const UNITS = ["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "count"];

function UnitSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>
        Unit
      </option>
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

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

function MealCard({ meal }) {
  return (
    <div className="meal-card">
      <h3>{meal.name}</h3>
      <p className="meal-stats">
        ~{meal.protein_g}g protein · ~{meal.calories} kcal · {meal.dishes}{" "}
        {meal.dishes === 1 ? "dish" : "dishes"} to wash
      </p>
      <p>
        <strong>Ingredients:</strong> {meal.ingredients.join(", ")}
      </p>
      <ol>
        {meal.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

function Pantry({ onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const [nutrition, setNutrition] = useState({});
  const [meals, setMeals] = useState([]);
  const [mealStatus, setMealStatus] = useState("idle");
  const [mealError, setMealError] = useState("");

  useEffect(() => {
    async function loadPantry() {
      try {
        const res = await apiFetch("/pantry");
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        setError("Can't load your pantry.");
      } finally {
        setLoading(false);
      }
    }
    loadPantry();
  }, []);

  async function addItem(e) {
    e.preventDefault();
    try {
      const res = await apiFetch("/pantry", {
        method: "POST",
        body: JSON.stringify({ name, quantity: Number(quantity), unit }),
      });
      if (!res.ok) {
        setError(await getErrorMessage(res, "Couldn't add item."));
        return;
      }
      const newItem = await res.json();
      setItems([...items, newItem]);
      setName("");
      setQuantity("");
      setUnit("");
      setError("");
    } catch {
      setError("Can't reach the server.");
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditQuantity(String(item.quantity));
    // Older items may have a unit that's no longer allowed; make the user pick
    setEditUnit(UNITS.includes(item.unit) ? item.unit : "");
  }

  async function saveEdit(id) {
    try {
      const res = await apiFetch(`/pantry/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: Number(editQuantity), unit: editUnit }),
      });
      if (!res.ok) {
        setError(await getErrorMessage(res, "Couldn't update item."));
        return;
      }
      const updated = await res.json();
      setItems(items.map((item) => (item.id === id ? updated : item)));
      setEditingId(null);
      setError("");
    } catch {
      setError("Can't reach the server.");
    }
  }

  async function deleteItem(id) {
    try {
      const res = await apiFetch(`/pantry/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await getErrorMessage(res, "Couldn't delete item."));
        return;
      }
      setItems(items.filter((item) => item.id !== id));
      setNutrition((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setError("Can't reach the server.");
    }
  }

  async function loadNutrition(item) {
    setNutrition((prev) => ({ ...prev, [item.id]: { status: "loading" } }));
    try {
      const res = await apiFetch(`/nutrition?query=${encodeURIComponent(item.name)}`);
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

  async function suggestMeals() {
    setMealStatus("loading");
    setMealError("");
    try {
      const res = await apiFetch("/meals/suggest", { method: "POST" });
      if (!res.ok) {
        setMealError(await getErrorMessage(res, "Couldn't get suggestions."));
        setMealStatus("error");
        return;
      }
      setMeals(await res.json());
      setMealStatus("done");
    } catch {
      setMealError("Can't reach the server.");
      setMealStatus("error");
    }
  }

  function renderItem(item) {
    if (editingId === item.id) {
      return (
        <form
          className="edit-row"
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit(item.id);
          }}
        >
          <span className="item-name">{item.name}</span>
          <input
            type="number"
            step="any"
            min="0.01"
            max="100000"
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
            required
          />
          <UnitSelect value={editUnit} onChange={setEditUnit} />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditingId(null)}>
            Cancel
          </button>
        </form>
      );
    }

    return (
      <div className="item-row">
        <span>
          {item.name} ({item.quantity} {item.unit})
        </span>
        <div className="item-actions">
          <button onClick={() => loadNutrition(item)}>Nutrition</button>
          <button onClick={() => startEdit(item)}>Edit</button>
          <button onClick={() => deleteItem(item.id)}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Pantry</h1>
        <button onClick={onLogout}>Log out</button>
      </header>

      <form className="add-form" onSubmit={addItem}>
        <input
          placeholder="Item (e.g. chicken breast)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <input
          type="number"
          step="any"
          min="0.01"
          max="100000"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <UnitSelect value={unit} onChange={setUnit} />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading your pantry...</p>
      ) : items.length === 0 ? (
        <p className="empty">Pantry's empty. Add something above.</p>
      ) : (
        <ul className="pantry-list">
          {items.map((item) => (
            <li key={item.id}>
              {renderItem(item)}
              <NutritionInfo info={nutrition[item.id]} />
            </li>
          ))}
        </ul>
      )}

      <section className="meals">
        <button
          onClick={suggestMeals}
          disabled={items.length === 0 || mealStatus === "loading"}
        >
          {mealStatus === "loading" ? "Thinking..." : "Suggest high-protein meals"}
        </button>
        {mealError && <p className="error">{mealError}</p>}
        {meals.map((meal, i) => (
          <MealCard key={`${meal.name}-${i}`} meal={meal} />
        ))}
      </section>
    </main>
  );
}

export default Pantry;