import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
            <Pressable
              key={plant.id}
              onPress={() => router.push(`/pages/dashboard/${plant.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
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
                    <Ionicons name="warning" size={20} color="#FFB020" />
                  ) : (
                    <Ionicons name="checkmark" size={20} color="#29DCA0" />
                  )}
                </View>

                <View style={styles.detailsButton}>
                  <Text style={styles.detailsText}>View details</Text>
                  <Ionicons name="arrow-forward" size={16} color="#1E6CFF" />
                </View>
              </View>
            </Pressable>
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
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  logoRow: {
    alignItems: "center",
    paddingBottom: 2,
  },
  logo: {
    width: 72,
    height: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#1C1C1C",
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  headerTitle: {
    color: "#FCFCFC",
    fontSize: 14,
    fontWeight: "800",
  },
  headerCount: {
    color: "#7E7E7E",
    fontSize: 10,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 1,
  },
  filterChip: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
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
    fontSize: 10,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterChipTextInactive: {
    color: "#FCFCFC",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  card: {
    backgroundColor: "#0B0B0B",
    borderColor: "#292929",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  statusPill: {
    minHeight: 22,
    paddingHorizontal: 8,
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
    fontSize: 10,
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
    gap: 8,
  },
  powerBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  powerValue: {
    color: "#FCFCFC",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  powerUnit: {
    color: "#FCFCFC",
    fontSize: 11,
    fontWeight: "500",
    paddingBottom: 3,
  },
  availabilityBlock: {
    alignItems: "flex-end",
    paddingTop: 8,
  },
  smallLabel: {
    color: "#8C8C8C",
    fontSize: 10,
    fontWeight: "500",
  },
  availabilityValue: {
    marginTop: 2,
    color: "#8C8C8C",
    fontSize: 11,
    fontWeight: "600",
  },
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  energyValue: {
    color: "#FCFCFC",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 20,
  },
  statusIconWrap: {
    width: 18,
    height: 18,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  detailsText: {
    color: "#1E6CFF",
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
