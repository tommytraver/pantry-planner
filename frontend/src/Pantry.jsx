import { useEffect, useState } from "react";
import { apiFetch } from "./api";

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
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [nutrition, setNutrition] = useState({});
  const [meals, setMeals] = useState([]);
  const [mealStatus, setMealStatus] = useState("idle");

  useEffect(() => {
    async function loadPantry() {
      try {
        const res = await apiFetch("/pantry");
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        setError("Can't load your pantry.");
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
      const res = await apiFetch(`/pantry/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems(items.filter((item) => item.id !== id));
    } catch {
      setError("Couldn't delete item.");
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
    try {
      const res = await apiFetch("/meals/suggest", { method: "POST" });
      if (!res.ok) throw new Error();
      setMeals(await res.json());
      setMealStatus("done");
    } catch {
      setMealStatus("error");
    }
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

      <section className="meals">
        <button
          onClick={suggestMeals}
          disabled={items.length === 0 || mealStatus === "loading"}
        >
          {mealStatus === "loading" ? "Thinking..." : "Suggest high-protein meals"}
        </button>
        {mealStatus === "error" && (
          <p className="error">Couldn't get suggestions. Try again.</p>
        )}
        {meals.map((meal) => (
          <MealCard key={meal.name} meal={meal} />
        ))}
      </section>
    </main>
  );
}

export default Pantry;