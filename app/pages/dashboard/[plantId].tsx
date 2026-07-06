import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PlantBottomNav } from "../../components/PlantBottomNav";
import { PlantHeader } from "../../components/PlantHeader";
import { loadSession } from "../../lib/auth";
import {
  fetchDashboard,
  getCachedDashboard,
  startDashboardLiveUpdates,
  type DashboardSummary,
} from "../../lib/dashboard";

function resolveParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

type SectionCardProps = {
  title: string;
  accent: string;
  children: ReactNode;
};

function SectionCard({ title, accent, children }: SectionCardProps) {
  return (
    <View style={[styles.sectionCard, { borderColor: accent }]}>
      <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function PlantDashboardPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ plantId?: string | string[] }>();
  const plantId = useMemo(() => resolveParam(params.plantId), [params.plantId]);
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 430, 0.8), 0.92);
  const s = (value: number) => Math.round(value * scale);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(getCachedDashboard(plantId || "anorchi-lanka"));

  useEffect(() => {
    let cancelled = false;
    let stopLiveUpdates: (() => void) | null = null;

    async function bootstrap() {
      const session = await loadSession();
      if (cancelled) return;

      if (!session?.authToken) {
        router.replace("/pages/login");
        await SplashScreen.hideAsync().catch(() => {});
        return;
      }

      const resolvedPlantId = plantId || "anorchi-lanka";
      const cached = getCachedDashboard(resolvedPlantId);
      if (cached) {
        setDashboard(cached);
      }

      const result = await fetchDashboard(resolvedPlantId, session.authToken);
      if (cancelled) return;

      setDashboard(result);
      stopLiveUpdates = startDashboardLiveUpdates(
        resolvedPlantId,
        session.authToken,
        {
          onUpdate: (nextDashboard) => {
            if (cancelled) return;
            setDashboard(nextDashboard);
          },
        },
        result,
      );
      setReady(true);
      setLoading(false);
      await SplashScreen.hideAsync().catch(() => {});
    }

    void bootstrap();

    return () => {
      cancelled = true;
      stopLiveUpdates?.();
    };
  }, [plantId, router]);

  const current = dashboard;

  const generalItems = current?.general || [];
  const realtimeItems = current?.realtime || [];
  const performanceItems = current?.performance || [];
  const financialRows = current?.financial.rows || [];

  if (!ready || loading || !current) {
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
        <PlantHeader
          title={current.plantName}
          activeLabel={current.activeLabel}
          onMenuPress={() => Alert.alert("Menu", "Plant menu will be added next.")}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SectionCard title="General" accent="#16C77D">
            <View style={styles.generalGrid}>
              {generalItems.map((item) => (
                <View key={item.key} style={[styles.valueBlock, { minHeight: s(58) }]}>
                  <Text style={[styles.valueLabelGreen, { fontSize: s(10) }]}>{item.label}</Text>
                  <Text style={[styles.valueText, { fontSize: s(15), lineHeight: s(18) }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Real Time Plant Data" accent="#7A3DFF">
            <View style={styles.metricGrid}>
              {realtimeItems.map((item) => (
                <View key={item.key} style={[styles.metricTile, { paddingVertical: s(9), paddingHorizontal: s(8), borderRadius: s(10) }]}>
                  <Text style={[styles.metricLabelPurple, { fontSize: s(9) }]}>{item.label}</Text>
                  <Text style={[styles.metricValue, { fontSize: s(13), lineHeight: s(16) }]}>{item.value}</Text>
                  {item.unit ? <Text style={[styles.metricUnit, { fontSize: s(9) }]}>{item.unit}</Text> : null}
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Performance KPIs" accent="#3A7CFF">
            <View style={styles.metricGrid}>
              {performanceItems.map((item) => (
                <View key={item.key} style={[styles.metricTile, { paddingVertical: s(9), paddingHorizontal: s(8), borderRadius: s(10) }]}>
                  <Text style={[styles.metricLabelBlue, { fontSize: s(9) }]}>{item.label}</Text>
                  <Text style={[styles.metricValue, { fontSize: s(13), lineHeight: s(16) }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Financial Metrics" accent="#1F8E4E">
            <View style={styles.financeHeadRow}>
              <Text style={[styles.financeCorner, { width: s(44) }]} />
              <View style={styles.financeTags}>
                <View style={styles.financeTagPositive}>
                  <Text style={[styles.financeTagPositiveText, { fontSize: s(9) }]}>ENERGY</Text>
                </View>
                <View style={styles.financeTagPositive}>
                  <Text style={[styles.financeTagPositiveText, { fontSize: s(9) }]}>REVENUE</Text>
                </View>
                <View style={styles.financeTagNegative}>
                  <Text style={[styles.financeTagNegativeText, { fontSize: s(9) }]}>LOSS PERF</Text>
                </View>
                <View style={styles.financeTagNegative}>
                  <Text style={[styles.financeTagNegativeText, { fontSize: s(9) }]}>LOSS CURT</Text>
                </View>
              </View>
            </View>

            <View style={styles.financeRows}>
              {financialRows.map((row) => (
                <View key={row.label} style={styles.financeRow}>
                  <Text style={[styles.financeRowLabel, { width: s(44), fontSize: s(10) }]}>{row.label}</Text>
                  <View style={styles.financeCells}>
                    <View style={[styles.financeCell, { paddingVertical: s(7), paddingHorizontal: s(5), borderRadius: s(7) }]}>
                      <Text style={[styles.financeCellPositive, { fontSize: s(13) }]}>{row.energy.split(" ")[0]}</Text>
                      <Text style={[styles.financeCellUnit, { fontSize: s(9) }]}>kWh</Text>
                    </View>
                    <View style={[styles.financeCell, { paddingVertical: s(7), paddingHorizontal: s(5), borderRadius: s(7) }]}>
                      <Text style={[styles.financeCellPositive, { fontSize: s(13) }]}>{row.revenue.split(" ")[0]}</Text>
                      <Text style={[styles.financeCellUnit, { fontSize: s(9) }]}>LKR</Text>
                    </View>
                    <View style={[styles.financeCell, { paddingVertical: s(7), paddingHorizontal: s(5), borderRadius: s(7) }]}>
                      <Text style={[styles.financeCellNegative, { fontSize: s(13) }]}>{row.lossPerf.split(" ")[0]}</Text>
                      <Text style={[styles.financeCellUnit, { fontSize: s(9) }]}>LKR</Text>
                    </View>
                    <View style={[styles.financeCell, { paddingVertical: s(7), paddingHorizontal: s(5), borderRadius: s(7) }]}>
                      <Text style={[styles.financeCellNegative, { fontSize: s(13) }]}>{row.lossCurt.split(" ")[0]}</Text>
                      <Text style={[styles.financeCellUnit, { fontSize: s(9) }]}>LKR</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>
        </ScrollView>

        <PlantBottomNav
          active="home"
          onNavigate={(key) => {
            if (key === "home") return;
            Alert.alert("Coming soon", `${key} screen will be added next.`);
          }}
        />
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
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
    gap: 8,
  },
  sectionCard: {
    position: "relative",
    backgroundColor: "#0B0B0B",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
    overflow: "hidden",
  },
  sectionAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  sectionTitle: {
    color: "#FCFCFC",
    fontSize: 15,
    fontWeight: "800",
  },
  generalGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  valueBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0C0C0C",
    borderColor: "#1E1E1E",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  valueLabelGreen: {
    color: "#19D3A3",
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  valueText: {
    color: "#FCFCFC",
    fontWeight: "800",
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 6,
  },
  metricTile: {
    flex: 1,
    backgroundColor: "#0C0C0C",
    borderColor: "#1E1E1E",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  metricLabelPurple: {
    color: "#8A4DFF",
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  metricLabelBlue: {
    color: "#4D8CFF",
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  metricValue: {
    color: "#FCFCFC",
    fontWeight: "800",
    textAlign: "center",
  },
  metricUnit: {
    color: "#A1A1A1",
    fontWeight: "600",
  },
  financeHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  financeCorner: {
    width: 44,
  },
  financeTags: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  financeTagPositive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    minHeight: 20,
    backgroundColor: "#11251A",
  },
  financeTagPositiveText: {
    color: "#58D9B3",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  financeTagNegative: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    minHeight: 20,
    backgroundColor: "#251515",
  },
  financeTagNegativeText: {
    color: "#FF9DA0",
    fontWeight: "800",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  financeRows: {
    gap: 6,
  },
  financeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
  },
  financeRowLabel: {
    width: 44,
    color: "#B3B3B3",
    fontWeight: "800",
    letterSpacing: 1.2,
    alignSelf: "center",
  },
  financeCells: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  financeCell: {
    flex: 1,
    backgroundColor: "#0C0C0C",
    borderColor: "#1E1E1E",
    borderWidth: 1,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  financeCellPositive: {
    color: "#58F0C5",
    fontWeight: "800",
  },
  financeCellNegative: {
    color: "#FF9DA0",
    fontWeight: "800",
  },
  financeCellUnit: {
    color: "#A1A1A1",
    fontWeight: "600",
  },
});
