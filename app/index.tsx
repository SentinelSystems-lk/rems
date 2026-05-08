import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Select Module</Text>
        <Pressable
          style={styles.optionButton}
          onPress={() => router.push({ pathname: "/webview", params: { mode: "monitoring" } })}
        >
          <Text style={styles.optionText}>Monitoring</Text>
        </Pressable>
        <Pressable
          style={styles.optionButton}
          onPress={() => router.push({ pathname: "/webview", params: { mode: "maintainance" } })}
        >
          <Text style={styles.optionText}>Maintainance</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#171717", padding: 0, margin: 0 },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    color: "#f2f7fb",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  optionButton: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#3f708c",
  },
  optionText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
