import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { addSnack, getSnacks, updateSnack, deleteSnack } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import { groupSnacksByProduct } from "../utils/products";
import { resolveImageSource } from "../utils/images";

const CATEGORY_ICONS = {
  Chips: "🥔",
  Biscuits: "🍪",
  Candy: "🍫",
  Drinks: "🥤",
  Snack: "🍟",
  General: "🍿",
  Other: "📦",
};

const CATEGORIES = [
  "General",
  "Chips",
  "Snack",
  "Drinks",
  "Candy",
  "Biscuits",
  "Other",
];

function ProductModal({ visible, initial, onClose, onSave, onUpdate, theme }) {
  const isEdit = !!initial;

  const buildInitialState = () => {
    if (!initial) {
      return {
        name: "",
        brand: "",
        category: "General",
        unit: "pcs",
        image: "",
        variants: [{ flavor: "", prices: [{ price: "" }] }],
      };
    }
    // Group existing variant rows by flavor, then by price, carrying the id so
    // stock/logs are preserved on unchanged rows.
    const flavorMap = new Map();
    for (const v of initial.variants) {
      const flavor = String(v.flavor || "").trim();
      if (!flavorMap.has(flavor)) flavorMap.set(flavor, []);
      flavorMap.get(flavor).push({ id: v.id, price: String(v.price ?? "") });
    }
    const variants = Array.from(flavorMap.entries()).map(
      ([flavor, prices]) => ({
        flavor,
        prices: prices.map((p) => ({ id: p.id, price: p.price })),
      }),
    );
    return {
      name: initial.name || "",
      brand: initial.brand || "",
      category: initial.category || "General",
      unit: initial.unit || "pcs",
      image: initial.image || initial.variants?.[0]?.image || "",
      variants,
    };
  };

  const [state, setState] = useState(buildInitialState);
  const { name, brand, category, unit, image, variants } = state;

  const setVariants = (updater) =>
    setState((prev) => ({ ...prev, variants: updater(prev.variants) }));
  const setName = (value) => setState((prev) => ({ ...prev, name: value }));
  const setBrand = (value) => setState((prev) => ({ ...prev, brand: value }));
  const setCategory = (value) =>
    setState((prev) => ({ ...prev, category: value }));
  const setUnit = (value) => setState((prev) => ({ ...prev, unit: value }));
  const setImage = (value) => setState((prev) => ({ ...prev, image: value }));

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return Alert.alert(
          "Permission needed",
          "Allow photo library access to add a product image.",
        );
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.base64) {
        const uri = asset.uri || "";
        const mime =
          uri
            .match(/\.(png|jpg|jpeg|webp|gif|heic|heif|bmp)$/i)?.[1]
            .toLowerCase() || "jpeg";
        setImage(`data:image/${mime};base64,${asset.base64}`);
      } else if (asset.uri) {
        setImage(asset.uri);
      }
    } catch (e) {
      Alert.alert("Image Picker Error", e.message);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedBrand = brand.trim();

    // Expand each flavor and its list of prices into one row per price,
    // carrying the variant id so unchanged rows keep their stock/logs.
    const expanded = [];
    for (const variant of variants) {
      const flavor = String(variant.flavor || "").trim();
      const validPrices = (variant.prices || [])
        .map((p) => ({
          id: p.id ?? null,
          price: parseFloat(p.price),
        }))
        .filter((p) => !Number.isNaN(p.price));
      if (!flavor && !validPrices.length) continue;
      for (const p of validPrices) {
        expanded.push({ id: p.id, flavor, price: p.price });
      }
    }

    if (
      !trimmedName &&
      !trimmedBrand &&
      expanded.every((variant) => !variant.flavor)
    ) {
      return Alert.alert("Enter a product name or variant details");
    }
    if (!expanded.length) {
      return Alert.alert("Add at least one variant");
    }
    if (
      expanded.some(
        (variant) => Number.isNaN(variant.price) || variant.price <= 0,
      )
    ) {
      return Alert.alert("Enter a valid unit price for every variant");
    }

    const payload = {
      name: trimmedName,
      brand: trimmedBrand,
      category,
      unit: unit.trim() || "pcs",
      image,
      variants: expanded,
    };
    if (isEdit) {
      onUpdate(payload);
    } else {
      onSave(payload);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons
                    name={isEdit ? "create-outline" : "add"}
                    size={20}
                    color="#fff"
                  />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {isEdit ? "Edit Product" : "New Product"}
                  </Text>
                  <Text
                    style={[styles.modalSubtitle, { color: theme.textMuted }]}
                  >
                    {isEdit
                      ? "Update flavors &amp; prices"
                      : "Add a snack with flavors &amp; prices"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.input }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Basic details */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                BASIC DETAILS
              </Text>
              <View style={[styles.fieldGroup, { borderColor: theme.border }]}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIconWrap}>
                    <Ionicons name="cube-outline" size={18} color="#6c63ff" />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.fieldInput,
                      {
                        backgroundColor: theme.input,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Product name (e.g. Lays)"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIconWrap}>
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color="#6c63ff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.fieldInput,
                      {
                        backgroundColor: theme.input,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="Brand (optional)"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
              </View>

              {/* Product image */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                PRODUCT IMAGE
              </Text>
              <TouchableOpacity
                style={[styles.imagePicker, { borderColor: theme.border }]}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                {image ? (
                  <Image
                    source={resolveImageSource(image)}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={28} color="#6c63ff" />
                    <Text
                      style={[
                        styles.imagePickerText,
                        { color: theme.textMuted },
                      ]}
                    >
                      Tap to choose an image
                    </Text>
                  </View>
                )}
                <View style={styles.imagePickerOverlay}>
                  <Ionicons name="camera-outline" size={16} color="#fff" />
                  <Text style={styles.imagePickerOverlayText}>
                    {image ? "Change" : "Add"}
                  </Text>
                </View>
              </TouchableOpacity>
              {image ? (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImage("")}
                >
                  <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                  <Text style={styles.removeImageText}>Remove image</Text>
                </TouchableOpacity>
              ) : null}

              {/* Variants */}
              <View style={styles.variantHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  FLAVORS &amp; PRICES
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setVariants((prev) => [
                      ...prev,
                      { flavor: "", prices: [{ price: "" }] },
                    ])
                  }
                >
                  <Text style={styles.addFlavorText}>+ Add flavor</Text>
                </TouchableOpacity>
              </View>

              {variants.map((variant, index) => (
                <View
                  key={`variant-${index}`}
                  style={[styles.variantCard, { borderColor: theme.border }]}
                >
                  <View style={styles.variantCardHeader}>
                    <View
                      style={[
                        styles.variantIndex,
                        { backgroundColor: "#6c63ff22" },
                      ]}
                    >
                      <Text
                        style={[styles.variantIndexText, { color: "#6c63ff" }]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        styles.flavorInput,
                        {
                          backgroundColor: theme.input,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={variant.flavor}
                      onChangeText={(value) => {
                        setVariants((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, flavor: value } : item,
                          ),
                        );
                      }}
                      placeholder="Flavor name (e.g. Masala)"
                      placeholderTextColor={theme.placeholder}
                    />
                    {variants.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeVariantButton}
                        onPress={() =>
                          setVariants((prev) =>
                            prev.filter((_, idx) => idx !== index),
                          )
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#ff6b6b"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.priceHint, { color: theme.textMuted }]}>
                    Unit price
                  </Text>
                  {(variant.prices || []).map((priceRow, pIdx) => (
                    <View key={`price-${pIdx}`} style={styles.priceRow}>
                      <View
                        style={[
                          styles.priceFieldWide,
                          {
                            backgroundColor: theme.input,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.currency, { color: theme.textMuted }]}
                        >
                          ₨
                        </Text>
                        <TextInput
                          style={[styles.priceInput, { color: theme.text }]}
                          value={priceRow.price}
                          onChangeText={(value) => {
                            setVariants((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? {
                                      ...item,
                                      prices: item.prices.map((p, pi) =>
                                        pi === pIdx
                                          ? { ...p, price: value }
                                          : p,
                                      ),
                                    }
                                  : item,
                              ),
                            );
                          }}
                          keyboardType="numeric"
                          placeholder="Price"
                          placeholderTextColor={theme.placeholder}
                        />
                      </View>
                      {variant.prices.length > 1 && (
                        <TouchableOpacity
                          onPress={() =>
                            setVariants((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? {
                                      ...item,
                                      prices: item.prices.filter(
                                        (_, pi) => pi !== pIdx,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color="#ff6b6b"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addPriceButton}
                    onPress={() =>
                      setVariants((prev) =>
                        prev.map((item, idx) =>
                          idx === index
                            ? {
                                ...item,
                                prices: [...item.prices, { price: "" }],
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color="#6c63ff"
                    />
                    <Text style={[styles.addPriceText, { color: "#6c63ff" }]}>
                      Add another price
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Category */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                CATEGORY
              </Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.categoryChip,
                      { borderColor: theme.border },
                      category === item && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(item)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: category === item ? "#fff" : theme.textMuted,
                        },
                      ]}
                    >
                      {CATEGORY_ICONS[item] || "🍿"} {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Unit */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                UNIT
              </Text>
              <View style={[styles.fieldGroup, { borderColor: theme.border }]}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIconWrap}>
                    <Ionicons
                      name="calculator-outline"
                      size={18}
                      color="#6c63ff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.fieldInput,
                      {
                        backgroundColor: theme.input,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="e.g. pcs, pack, bottle"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
              </View>

              <View style={styles.formFooter}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: theme.textMuted },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>
                    {isEdit ? "Save Changes" : "Save Product"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProductCard({ product, onPress, onEdit, theme }) {
  const priceLabel =
    product.prices.length > 1
      ? `${product.prices[0]}–${product.prices[product.prices.length - 1]}`
      : `${product.prices[0] ?? 0}`;
  const variantLabel = product.flavors.length
    ? `${product.flavors.length} flavor${product.flavors.length > 1 ? "s" : ""}`
    : `${product.variants.length} variant${product.variants.length > 1 ? "s" : ""}`;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.cardAlt,
          borderColor: theme.border,
          shadowColor: theme.text,
        },
      ]}
      onPress={() => onPress(product)}
      activeOpacity={1}
    >
      {/* Hero image / emoji area */}
      <View style={styles.hero}>
        {product.image ? (
          <Image
            source={resolveImageSource(product.image)}
            style={styles.heroImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.heroFallback, { backgroundColor: "#6c63ff" }]}>
            <Text style={styles.heroEmoji}>
              {CATEGORY_ICONS[product.category] || "🍿"}
            </Text>
          </View>
        )}

        {/* Category badge overlay (top-left) */}
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: "#ffffffcc", borderColor: theme.border },
          ]}
        >
          <Text style={[styles.categoryBadgeText, { color: theme.textrev }]}>
            {product.category || "General"}
          </Text>
        </View>

        {/* Edit button overlay (top-right) */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: "#ffffffcc" }]}
          onPress={() => onEdit(product)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={15} color="#6c63ff" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardName, { color: theme.text }]}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        {product.brand && product.brand !== product.name ? (
          <Text style={[styles.cardBrand, { color: theme.textMuted }]}>
            {product.brand}
          </Text>
        ) : null}
        <View style={styles.variantRow}>
          <Ionicons name="layers-outline" size={12} color={theme.textMuted} />
          <Text style={[styles.cardVariant, { color: theme.textMuted }]}>
            {variantLabel}
          </Text>
        </View>

        <Text style={[styles.cardPriceLabel, { color: theme.textMuted }]}>
          ₨{priceLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProductsScreen({ navigation }) {
  const { theme } = useTheme();
  const [snacks, setSnacks] = useState([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const load = async () => setSnacks(await getSnacks());

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAddSnack = async ({
    name,
    brand,
    category,
    unit,
    image,
    variants,
  }) => {
    for (const v of variants) {
      await addSnack(name, category, 0, unit, v.price, brand, v.flavor, image);
    }
    setShowAddModal(false);
    await load();
  };

  const handleUpdateProduct = async ({
    name,
    brand,
    category,
    unit,
    image,
    variants,
  }) => {
    const existingIds = new Set(
      (editingProduct?.variants || []).map((v) => v.id),
    );
    for (const v of variants) {
      if (v.id && existingIds.has(v.id)) {
        // Update an existing variant row (preserves its stock/logs).
        await updateSnack(
          v.id,
          name,
          category,
          unit,
          v.price,
          brand,
          v.flavor,
          image,
        );
      } else {
        // Newly added flavor/price row.
        await addSnack(
          name,
          category,
          0,
          unit,
          v.price,
          brand,
          v.flavor,
          image,
        );
      }
    }
    // Delete variant rows that were removed from the product.
    const keptIds = new Set(
      variants.filter((v) => v.id != null).map((v) => v.id),
    );
    for (const existing of editingProduct?.variants || []) {
      if (!keptIds.has(existing.id)) {
        await deleteSnack(existing.id);
      }
    }
    setEditingProduct(null);
    await load();
  };

  const products = groupSnacksByProduct(snacks);

  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);

  const filtered = products.filter((p) => {
    if (!searchTerms.length) return true;

    const searchableText = [
      p.name,
      p.brand,
      p.category,
      ...p.flavors,
      ...p.prices.map(String),
      p.unit,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(" ");

    return searchTerms.every((term) => searchableText.includes(term));
  });

  const openProduct = (product) => {
    // A product with exactly one variant and no flavor concept can jump
    // straight to the manage screen — no picker needed.
    if (product.variants.length === 1 && product.flavors.length === 0) {
      navigation.navigate("SnackDetail", { snack: product.variants[0] });
      return;
    }
    navigation.navigate("ProductDetail", {
      productKey: product.key,
      productName: product.name,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => `product-${item.key}`}
        numColumns={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            theme={theme}
            onPress={openProduct}
            onEdit={setEditingProduct}
          />
        )}
        ListHeaderComponent={
          <View>
            <TextInput
              style={[
                styles.search,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Search products..."
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: theme.card, borderColor: "#6c63ff" },
              ]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#6c63ff" />
              <Text style={[styles.addButtonText, { color: "#6c63ff" }]}>
                Add Custom Snack
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🍿</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No products available right now. Add your first snack to get
              started.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyButtonText}>Add Custom Snack</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
        contentContainerStyle={styles.list}
      />

      <ProductModal
        key={editingProduct ? `edit-${editingProduct.key}` : "add"}
        visible={showAddModal || !!editingProduct}
        initial={editingProduct}
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
        }}
        onSave={handleAddSnack}
        onUpdate={handleUpdateProduct}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addButtonText: { fontSize: 14, fontWeight: "600" },
  card: {
    flex: 1,
    width: "100%",
    borderRadius: 20,
    minHeight: 210,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  accentBar: { height: 4 },
  hero: {
    height: 160,
    position: "relative",
    backgroundColor: "#fff",
  },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 36 },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  editButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 12 },
  cardBrand: { fontSize: 11, marginBottom: 4 },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  cardVariant: { fontSize: 11 },
  cardPriceLabel: { fontSize: 15, fontWeight: "800", color: "#6c63ff" },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  emptyButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  input: { borderRadius: 10, fontSize: 15, borderWidth: 1 },
  fieldGroup: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 6,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  fieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#6c63ff11",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldInput: { flex: 1 },
  imagePicker: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: 8,
  },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imagePickerText: { fontSize: 13, fontWeight: "600" },
  imagePreview: { width: "100%", height: "100%" },
  imagePickerOverlay: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00000088",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imagePickerOverlayText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  removeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 16,
  },
  removeImageText: { fontSize: 13, fontWeight: "600", color: "#ff6b6b" },
  variantHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addFlavorText: { fontSize: 13, fontWeight: "600", color: "#6c63ff" },
  variantCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  variantCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  variantIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  variantIndexText: { fontSize: 13, fontWeight: "700" },
  flavorInput: { flex: 1, padding: 12 },
  removeVariantButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ff6b6b11",
    alignItems: "center",
    justifyContent: "center",
  },
  priceHint: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  priceFieldWide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  currency: { fontSize: 13, fontWeight: "700", marginRight: 6 },
  priceInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  addPriceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  addPriceText: { fontSize: 13, fontWeight: "600" },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: { backgroundColor: "#6c63ff", borderColor: "#6c63ff" },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  formFooter: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 15, fontWeight: "600" },
  saveButton: {
    flex: 1.6,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
