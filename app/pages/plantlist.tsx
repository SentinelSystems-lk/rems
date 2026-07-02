import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { loadSession } from "../lib/auth";
import { fetchPlantSummaries, formatCapacityMw, formatEnergyKwh, type PlantSummary, getFallbackPlantCount } from "../lib/plants";

type Filter = "all" | "active" | "inactive";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

export default function PlantListPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = await loadSession();
      if (cancelled) return;

      if (!session?.authToken) {
        router.replace("/pages/login");
        await SplashScreen.hideAsync().catch(() => {});
        return;
      }

      const items = await fetchPlantSummaries(session.authToken);
      if (cancelled) return;

      setPlants(items);
      setReady(true);
      setLoading(false);
      await SplashScreen.hideAsync().catch(() => {});
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const filteredPlants = useMemo(() => {
    if (filter === "active") return plants.filter((plant) => plant.isActive);
    if (filter === "inactive") return plants.filter((plant) => !plant.isActive);
    return plants;
  }, [filter, plants]);

  const siteCount = plants.length > 0 ? 21 : getFallbackPlantCount();

  if (!ready || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingShell}>
          <ActivityIndicator color="#FCFCFC" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topSection}>
          <View style={styles.logoRow}>
            <Image source={require("../../assets/images/Logo/logo.png")} resizeMode="contain" style={styles.logo} />
          </View>

          <View style={styles.divider} />

          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Plant List</Text>
              <Text style={styles.headerCount}>{siteCount} sites</Text>
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      active ? styles.filterChipActive : styles.filterChipInactive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filteredPlants.map((plant) => (
            <View key={plant.id} style={styles.card}>
              <View style={styles.cardStripe} />

              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{plant.name}</Text>
                <View style={[styles.statusPill, plant.isActive ? styles.statusPillActive : styles.statusPillInactive]}>
                  <Text style={[styles.statusPillText, plant.isActive ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                    {plant.isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.powerBlock}>
                  <Text style={styles.powerValue}>{formatCapacityMw(plant.capacityMw).replace(" MW", "")}</Text>
                  <Text style={styles.powerUnit}>MW</Text>
                </View>

                <View style={styles.availabilityBlock}>
                  <Text style={styles.smallLabel}>Avail.</Text>
                  <Text style={styles.availabilityValue}>
                    {plant.availability === null ? "—" : `${Math.round(plant.availability)}%`}
                  </Text>
                </View>
              </View>

              <View style={styles.todayRow}>
                <View>
                  <Text style={styles.smallLabel}>Today</Text>
                  <Text style={styles.energyValue}>{formatEnergyKwh(plant.todayEnergyKwh)}</Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.statusIconWrap}>
                  {plant.statusLabel === "Warning" ? (
                    <Ionicons name="warning" size={24} color="#FFB020" />
                  ) : (
                    <Ionicons name="checkmark" size={24} color="#29DCA0" />
                  )}
                </View>

                <Pressable
                  onPress={() => Alert.alert("Plant details", "Plant details screen will be added next.")}
                  style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
                >
                  <Text style={styles.detailsText}>View details</Text>
                  <Ionicons name="arrow-forward" size={18} color="#1E6CFF" />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  loadingShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505",
  },
  screen: {
    flex: 1,
    backgroundColor: "#050505",
  },
  topSection: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoRow: {
    alignItems: "center",
    paddingBottom: 4,
  },
  logo: {
    width: 82,
    height: 26,
  },
  divider: {
    height: 1,
    backgroundColor: "#1C1C1C",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  headerTitle: {
    color: "#FCFCFC",
    fontSize: 15,
    fontWeight: "800",
  },
  headerCount: {
    color: "#7E7E7E",
    fontSize: 11,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 1,
  },
  filterChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: "#2F7DFF",
    borderColor: "#2F7DFF",
  },
  filterChipInactive: {
    backgroundColor: "transparent",
    borderColor: "#D2D2D2",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterChipTextInactive: {
    color: "#FCFCFC",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  card: {
    backgroundColor: "#0B0B0B",
    borderColor: "#292929",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  cardStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#16C77D",
  },
  cardHeader: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    color: "#FCFCFC",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    flexShrink: 1,
  },
  statusPill: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillActive: {
    backgroundColor: "#0D2A1A",
  },
  statusPillInactive: {
    backgroundColor: "#2A2020",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillTextActive: {
    color: "#20B573",
  },
  statusPillTextInactive: {
    color: "#F28B8B",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  powerBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  powerValue: {
    color: "#FCFCFC",
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1,
  },
  powerUnit: {
    color: "#FCFCFC",
    fontSize: 12,
    fontWeight: "500",
    paddingBottom: 4,
  },
  availabilityBlock: {
    alignItems: "flex-end",
    paddingTop: 10,
  },
  smallLabel: {
    color: "#8C8C8C",
    fontSize: 11,
    fontWeight: "500",
  },
  availabilityValue: {
    marginTop: 2,
    color: "#8C8C8C",
    fontSize: 12,
    fontWeight: "600",
  },
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  energyValue: {
    color: "#FCFCFC",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 22,
  },
  statusIconWrap: {
    width: 20,
    height: 20,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsText: {
    color: "#1E6CFF",
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
