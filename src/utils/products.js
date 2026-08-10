// Groups individual stock rows (one row per brand+flavor+price variant) into
// "products" — e.g. every Lays row (Masala/Cheese/Salt × ₨20/40/70) becomes a
// single Lays product with a list of variants underneath it.

export const productKeyFor = (snack) => {
  // A product is uniquely identified by its name, brand, and category. Brand
  // is included so that two distinct products which happen to share the same
  // name (or share a brand) are never merged into a single visible item.
  const productName = (snack.name || snack.brand || "").trim().toLowerCase();
  const brand = (snack.brand || "").trim().toLowerCase();
  const category = (snack.category || "").trim().toLowerCase();
  return `${productName}::${brand}::${category}`;
};

export const formatVariantLabel = (snack) => {
  const parts = [snack.name || snack.brand, snack.flavor].filter(Boolean);
  return parts.join(" ").trim() || snack.name || snack.brand || "Unnamed";
};

export const groupSnacksByProduct = (snacks) => {
  const map = new Map();

  for (const snack of snacks) {
    const key = productKeyFor(snack);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: snack.name || snack.brand || "Unnamed",
        brand: snack.brand || "",
        category: snack.category || "General",
        unit: snack.unit || "pcs",
        image: snack.image || "",
        variants: [],
      });
    }
    map.get(key).variants.push(snack);
  }

  return Array.from(map.values())
    .map((group) => {
      const flavors = Array.from(
        new Set(
          group.variants.map((v) => (v.flavor || "").trim()).filter(Boolean),
        ),
      );
      const prices = Array.from(
        new Set(group.variants.map((v) => Number(v.price) || 0)),
      ).sort((a, b) => a - b);
      const totalStock = group.variants.reduce(
        (sum, v) => sum + (Number(v.stock) || 0),
        0,
      );
      const inStockVariants = group.variants.filter((v) => Number(v.stock) > 0);

      return { ...group, flavors, prices, totalStock, inStockVariants };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};
