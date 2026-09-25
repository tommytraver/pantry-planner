import { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "./api";

// Must match the Unit list in backend/models.py
const UNITS = ["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "count"];

const fmt = (v) => (v == null ? "?" : Math.round(v));

function macroLine(calories, protein, carbs, fat) {
  return `per 100g: ${fmt(calories)} kcal · ${fmt(protein)}g protein · ${fmt(carbs)}g carbs · ${fmt(fat)}g fat`;
}

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

function FoodInfo({ item }) {
  if (!item.fdc_id) return null;
  return (
    <p className="nutrition">
      {item.food_description},{" "}
      {macroLine(item.calories_100g, item.protein_100g, item.carbs_100g, item.fat_100g)}
    </p>
  );
}

function FoodPicker({ picker, onQueryChange, onSearch, onPick, onClose }) {
  return (
    <div className="picker">
      <form
        className="picker-search"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <input
          value={picker.query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={100}
          required
        />
        <button type="submit">Search</button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </form>

      {picker.status === "loading" && <p className="nutrition">Searching...</p>}
      {picker.status === "error" && <p className="nutrition error">{picker.error}</p>}
      {picker.status === "done" && picker.results.length === 0 && (
        <p className="nutrition">No matches. Try different words, like "egg whole raw".</p>
      )}

      <ul className="picker-results">
        {picker.results.map((food) => (
          <li key={food.fdc_id}>
            <div>
              <div>{food.description}</div>
              <div className="nutrition">
                {macroLine(food.calories, food.protein_g, food.carbs_g, food.fat_g)}
              </div>
            </div>
            <button onClick={() => onPick(food)}>Use this</button>
          </li>
        ))}
      </ul>
    </div>
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

  // { itemId, query, status, results, error } or null when closed
  const [picker, setPicker] = useState(null);

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

  function replaceItem(updated) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

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
      setItems((prev) => [...prev, newItem]);
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
      replaceItem(await res.json());
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
      setItems((prev) => prev.filter((item) => item.id !== id));
      setPicker((p) => (p && p.itemId === id ? null : p));
    } catch {
      setError("Can't reach the server.");
    }
  }

  // Only apply an update if the picker is still open for the same item
  function updatePicker(itemId, changes) {
    setPicker((p) => (p && p.itemId === itemId ? { ...p, ...changes } : p));
  }

  async function runSearch(itemId, query) {
    setPicker({ itemId, query, status: "loading", results: [], error: "" });
    try {
      const res = await apiFetch(`/nutrition?query=${encodeURIComponent(query)}`);
      if (!res.ok) {
        updatePicker(itemId, {
          status: "error",
          error: await getErrorMessage(res, "Search failed."),
        });
        return;
      }
      updatePicker(itemId, { status: "done", results: await res.json() });
    } catch {
      updatePicker(itemId, { status: "error", error: "Can't reach the server." });
    }
  }

  function togglePicker(item) {
    if (picker && picker.itemId === item.id) {
      setPicker(null);
    } else {
      runSearch(item.id, item.name);
    }
  }

  async function pickFood(itemId, food) {
    try {
      const res = await apiFetch(`/pantry/${itemId}/food`, {
        method: "PUT",
        body: JSON.stringify(food),
      });
      if (!res.ok) {
        updatePicker(itemId, {
          status: "error",
          error: await getErrorMessage(res, "Couldn't save match."),
        });
        return;
      }
      replaceItem(await res.json());
      setPicker(null);
    } catch {
      updatePicker(itemId, { status: "error", error: "Can't reach the server." });
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
          <button onClick={() => togglePicker(item)}>
            {item.fdc_id ? "Change food" : "Match food"}
          </button>
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
              <FoodInfo item={item} />
              {picker && picker.itemId === item.id && (
                <FoodPicker
                  picker={picker}
                  onQueryChange={(query) => updatePicker(item.id, { query })}
                  onSearch={() => runSearch(item.id, picker.query)}
                  onPick={(food) => pickFood(item.id, food)}
                  onClose={() => setPicker(null)}
                />
              )}
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