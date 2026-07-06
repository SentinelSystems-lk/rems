import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type PlantHeaderProps = {
  title: string;
  activeLabel?: string;
  onMenuPress?: () => void;
};

export function PlantHeader({ title, activeLabel = "Active", onMenuPress }: PlantHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Image source={require("../../assets/images/Logo/logo.png")} resizeMode="contain" style={styles.logo} />
      </View>

      <View style={styles.divider} />

      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rightGroup}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{activeLabel}</Text>
          </View>

          <Pressable hitSlop={12} onPress={onMenuPress} style={styles.menuButton}>
            <Ionicons name="menu" size={24} color="#FCFCFC" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  logoRow: {
    alignItems: "center",
    paddingBottom: 1,
  },
  logo: {
    width: 70,
    height: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#1C1C1C",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: "#FCFCFC",
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0D5030",
    backgroundColor: "#092217",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusText: {
    color: "#35C97A",
    fontSize: 11,
    fontWeight: "700",
  },
  menuButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
