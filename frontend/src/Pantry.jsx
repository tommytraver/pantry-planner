import { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "./api";

// Must match the Unit list in backend/models.py
const UNITS = ["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "count"];

const fmt = (v) => (v == null ? "?" : Math.round(v));

function UnitSelect({ value, onChange }) {
  return (
    <select
      className="field"
      aria-label="Unit"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
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

function Macros({ calories, protein, carbs, fat }) {
  return (
    <ul className="macros">
      <li className="protein">
        <strong>{fmt(protein)}g</strong> protein
      </li>
      <li>
        <strong>{fmt(calories)}</strong> kcal
      </li>
      <li>
        <strong>{fmt(carbs)}g</strong> carbs
      </li>
      <li>
        <strong>{fmt(fat)}g</strong> fat
      </li>
      <li>per 100g</li>
    </ul>
  );
}

function FoodInfo({ item }) {
  if (!item.fdc_id) return null;
  return (
    <div className="food-match">
      <div className="food-name">{item.food_description}</div>
      <Macros
        calories={item.calories_100g}
        protein={item.protein_100g}
        carbs={item.carbs_100g}
        fat={item.fat_100g}
      />
    </div>
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
          className="field"
          aria-label="Search USDA foods"
          value={picker.query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={100}
          required
        />
        <button className="btn btn-ghost" type="submit">
          Search
        </button>
        <button className="btn btn-quiet" type="button" onClick={onClose}>
          Close
        </button>
      </form>

      {picker.status === "loading" && <p className="status">Searching...</p>}
      {picker.status === "error" && <p className="error">{picker.error}</p>}
      {picker.status === "done" && picker.results.length === 0 && (
        <p className="status">
          No matches. Try simpler words, like "egg whole raw".
        </p>
      )}

      <ul className="picker-results">
        {picker.results.map((food) => (
          <li key={food.fdc_id}>
            <div>
              <div>{food.description}</div>
              <Macros
                calories={food.calories}
                protein={food.protein_g}
                carbs={food.carbs_g}
                fat={food.fat_g}
              />
            </div>
            <button className="btn btn-ghost" onClick={() => onPick(food)}>
              Use this
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealCard({ meal }) {
  return (
    <article className="meal-card">
      <div className="meal-protein">
        {Math.round(meal.protein_g)}g<span>protein, est.</span>
      </div>
      <div className="meal-body">
        <h3>{meal.name}</h3>
        <p className="meal-meta">
          About {Math.round(meal.calories)} kcal, {meal.dishes}{" "}
          {meal.dishes === 1 ? "dish" : "dishes"} to wash
        </p>
        <p>
          <strong>You'll use:</strong> {meal.ingredients.join(", ")}
        </p>
        <ol>
          {meal.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}

function Pantry({ onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [saving, setSaving] = useState(false);

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
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  async function addItem(e) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
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
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditQuantity(String(item.quantity));
    setEditUnit(UNITS.includes(item.unit) ? item.unit : "");
  }

  async function saveEdit(id) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/pantry/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: Number(editQuantity),
          unit: editUnit,
        }),
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
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name} from your pantry?`)) return;
    try {
      const res = await apiFetch(`/pantry/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await getErrorMessage(res, "Couldn't delete item."));
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setPicker((p) => (p && p.itemId === item.id ? null : p));
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
      const res = await apiFetch(
        `/nutrition?query=${encodeURIComponent(query)}`,
      );
      if (!res.ok) {
        updatePicker(itemId, {
          status: "error",
          error: await getErrorMessage(res, "Search failed."),
        });
        return;
      }
      updatePicker(itemId, { status: "done", results: await res.json() });
    } catch {
      updatePicker(itemId, {
        status: "error",
        error: "Can't reach the server.",
      });
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
      updatePicker(itemId, {
        status: "error",
        error: "Can't reach the server.",
      });
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
            className="field"
            type="number"
            step="any"
            min="0.01"
            max="100000"
            aria-label="Quantity"
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
            required
          />
          <UnitSelect value={editUnit} onChange={setEditUnit} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => setEditingId(null)}
          >
            Cancel
          </button>
        </form>
      );
    }

    return (
      <div className="item-row">
        <div>
          <span className="item-name">{item.name}</span>
          <span className="item-qty">
            {item.quantity} {item.unit}
          </span>
        </div>
        <div className="item-actions">
          <button className="btn btn-quiet" onClick={() => togglePicker(item)}>
            {item.fdc_id ? "Change food" : "Match food"}
          </button>
          <button className="btn btn-quiet" onClick={() => startEdit(item)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => deleteItem(item)}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Pantry</h1>
        <button className="btn btn-quiet" onClick={onLogout}>
          Log out
        </button>
      </header>

      <div className="layout">
        <section className="pantry-panel" aria-label="Your pantry">
          <form className="add-form" onSubmit={addItem}>
            <input
              className="field item-input"
              aria-label="Item name"
              placeholder="Item, like chicken breast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
            <input
              className="field"
              type="number"
              step="any"
              min="0.01"
              max="100000"
              aria-label="Quantity"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <UnitSelect value={unit} onChange={setUnit} />
            <button className="btn btn-primary" type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {loading ? (
            <p className="empty">Loading your pantry...</p>
          ) : items.length === 0 ? (
            <p className="empty">
              Nothing here yet. Add what you bought, like chicken breast, 3 lb.
            </p>
          ) : (
            <ul className="pantry-list">
              {items.map((item) => (
                <li key={item.id}>
                  {renderItem(item)}
                  <FoodInfo item={item} />
                  {picker && picker.itemId === item.id && (
                    <FoodPicker
                      picker={picker}
                      onQueryChange={(query) =>
                        updatePicker(item.id, { query })
                      }
                      onSearch={() => runSearch(item.id, picker.query)}
                      onPick={(food) => pickFood(item.id, food)}
                      onClose={() => setPicker(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="meals" aria-label="Meal ideas">
          <div className="meals-header">
            <h2>Meal ideas</h2>
            <button
              className="btn btn-primary"
              onClick={suggestMeals}
              disabled={items.length === 0 || mealStatus === "loading"}
            >
              {mealStatus === "loading"
                ? "Thinking..."
                : "Suggest high-protein meals"}
            </button>
          </div>
          {mealError && <p className="error">{mealError}</p>}
          {meals.length === 0 && mealStatus !== "loading" && !mealError && (
            <p className="status">
              Get three meal ideas built from what's in your pantry.
            </p>
          )}
          {meals.length > 0 && (
            <div className="meal-list">
              {meals.map((meal, i) => (
                <MealCard key={`${meal.name}-${i}`} meal={meal} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Pantry;
