import { Platform } from "react-native";

/**
 * Static map of all bundled local images.
 *
 * IMPORTANT: Any NEW image added under assets/images/ must also be added here
 * (with a static require) so Metro can bundle it. Dynamic require() with a
 * runtime string variable is NOT supported by Metro/React Native, so each
 * bundled asset must be listed explicitly.
 */
const LOCAL_ASSETS = {
  "./../../assets/images/lays.jpg": require("../../assets/images/lays.jpg"),
  "./../../assets/images/cocacola.jpg": require("../../assets/images/cocacola.jpg"),
  "./../../assets/images/kurkure.jpg": require("../../assets/images/kurkure.jpg"),
  "./../../assets/images/knoor-noodles.jpg": require("../../assets/images/knoor-noodles.jpg"),
  "./../../assets/images/Lemon-Sandwich.png": require("../../assets/images/Lemon-Sandwich.png"),
  "./../../assets/images/Gala.jpg": require("../../assets/images/Gala.jpg"),
  "./../../assets/images/Cafe.jpg": require("../../assets/images/Cafe.jpg"),
  "./../../assets/images/chocolate-sandwich.png": require("../../assets/images/chocolate-sandwich.png"),
  "./../../assets/images/Sonnet.jpg": require("../../assets/images/Sonnet.jpg"),
  "./../../assets/images/Now.jpg": require("../../assets/images/Now.jpg"),
  "./../../assets/images/Pepsi.jpg": require("../../assets/images/Pepsi.jpg"),
  "./../../assets/images/Dew.jpg": require("../../assets/images/Dew.jpg"),
  "./../../assets/images/Big-apple.jpg": require("../../assets/images/Big-apple.jpg"),
  "./../../assets/images/Oreo.jpg": require("../../assets/images/Oreo.jpg"),
  "./../../assets/images/tiger.png": require("../../assets/images/tiger.png"),
  "./../../assets/images/sooper.webp": require("../../assets/images/sooper.webp"),
  "./../../assets/images/kick.webp": require("../../assets/images/kick.webp"),
};

/**
 * Resolve an image field to a value usable by <Image source={...}>.
 * - Local bundled asset paths (e.g. "./../../assets/images/lays.jpg") are
 *   mapped to their static require() so the bundler can inline them.
 * - Remote URLs and base64/data/file/asset URIs are passed through unchanged.
 * - Anything unrecognized / empty returns null (caller falls back to emoji).
 */
export const resolveImageSource = (image) => {
  if (!image) return null;
  const value = String(image).trim();
  if (!value) return null;

  // Local bundled asset path → static require
  if (LOCAL_ASSETS[value]) return LOCAL_ASSETS[value];

  // Remote URL (http/https) or standard runtime-provided URI → pass through.
  if (
    Platform.OS === "web" ||
    /^https?:\/\//i.test(value) ||
    /^data:/i.test(value) ||
    /^file:/i.test(value) ||
    /^assets-library:/i.test(value) ||
    /^content:/i.test(value) ||
    /^ph:/i.test(value)
  ) {
    return { uri: value };
  }

  return null;
};
