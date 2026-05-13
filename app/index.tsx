import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowLeft} />
      <View style={styles.backgroundGlowBottom} />

      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.brandMark}>
            <Image source={require("../assets/images/Logo/logo.png")} style={styles.logo} resizeMode="contain" />
          </View>
          {/* <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active</Text>
          </View> */}
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Power Operations</Text>
          <Text style={styles.title}>Select a module</Text>
          <Text style={styles.subtitle}>
            Open the monitoring dashboard or switch to maintenance for system controls.
          </Text>

          <View style={styles.moduleGrid}>
            <Pressable
              style={({ pressed }) => [styles.moduleCard, styles.monitoringCard, pressed && styles.cardPressed]}
              onPress={() => router.push({ pathname: "/webview", params: { mode: "monitoring" } })}
            >
              <View style={[styles.iconBadge, styles.monitoringBadge]}>
                <Text style={styles.iconText}>M</Text>
              </View>
              <Text style={styles.moduleLabel}>Monitoring</Text>
              <Text style={styles.moduleCopy}>
                Live production overview, KPIs, alarms, and site status.
              </Text>
              <View style={styles.moduleCtaRow}>
                <Text style={styles.moduleCta}>Open dashboard</Text>
                <Text style={styles.moduleArrow}>›</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.moduleCard, styles.maintenanceCard, pressed && styles.cardPressed]}
              onPress={() => router.push({ pathname: "/webview", params: { mode: "maintainance" } })}
            >
              <View style={[styles.iconBadge, styles.maintenanceBadge]}>
                <Text style={styles.iconText}>S</Text>
              </View>
              <Text style={styles.moduleLabel}>Maintenance</Text>
              <Text style={styles.moduleCopy}>
                Service tools, system access, and maintenance workflows.
              </Text>
              <View style={styles.moduleCtaRow}>
                <Text style={styles.moduleCta}>Open console</Text>
                <Text style={styles.moduleArrow}>›</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#040608",
    padding: 0,
    margin: 0,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(20, 185, 129, 0.16)",
  },
  backgroundGlowLeft: {
    position: "absolute",
    top: 120,
    left: -110,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(58, 122, 255, 0.14)",
  },
  backgroundGlowBottom: {
    position: "absolute",
    right: -120,
    bottom: -120,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(14, 185, 129, 0.12)",
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  brandMark: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logo: {
    width: 96,
    height: 34,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(37, 197, 124, 0.24)",
    backgroundColor: "rgba(7, 38, 28, 0.82)",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: "#2dd67b",
    shadowColor: "#2dd67b",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  statusText: {
    color: "#8de9b8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  heroCard: {
    flex: 1,
    borderRadius: 32,
    padding: 20,
    backgroundColor: "rgba(8, 10, 14, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    justifyContent: "space-between",
  },
  kicker: {
    color: "#8d95a3",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#eef4fb",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#97a4b5",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
  },
  moduleGrid: {
    gap: 14,
  },
  moduleCard: {
    width: "100%",
    minHeight: 148,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(11, 15, 22, 0.95)",
    borderWidth: 1,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  monitoringCard: {
    borderColor: "rgba(70, 132, 255, 0.34)",
    shadowColor: "#4b83ff",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  maintenanceCard: {
    borderColor: "rgba(37, 197, 124, 0.28)",
    shadowColor: "#24c57c",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  monitoringBadge: {
    backgroundColor: "rgba(48, 96, 255, 0.16)",
    borderColor: "rgba(86, 140, 255, 0.28)",
  },
  maintenanceBadge: {
    backgroundColor: "rgba(18, 145, 95, 0.16)",
    borderColor: "rgba(40, 197, 124, 0.26)",
  },
  iconText: {
    color: "#eaf3ff",
    fontSize: 16,
    fontWeight: "800",
  },
  moduleLabel: {
    color: "#f0f4fa",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  moduleCopy: {
    color: "#95a1b3",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 280,
  },
  moduleCtaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moduleCta: {
    color: "#dbe6f4",
    fontSize: 14,
    fontWeight: "700",
  },
  moduleArrow: {
    color: "#8ea3be",
    fontSize: 28,
    lineHeight: 28,
    marginTop: -4,
  },
});
