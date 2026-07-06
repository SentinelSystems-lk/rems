import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type PlantBottomNavProps = {
  active: "home" | "curtailment" | "alarms" | "om";
  onNavigate?: (key: "home" | "curtailment" | "alarms" | "om") => void;
};

const ITEMS: {
  key: PlantBottomNavProps["active"];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "home", label: "home", icon: "home-outline" },
  { key: "curtailment", label: "Curtailment", icon: "trending-down-outline" },
  { key: "alarms", label: "Alarms", icon: "notifications-outline" },
  { key: "om", label: "O&M", icon: "build-outline" },
];

export function PlantBottomNav({ active, onNavigate }: PlantBottomNavProps) {
  return (
    <View style={styles.shell}>
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onNavigate?.(item.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Ionicons name={item.icon} size={20} color={isActive ? "#FCFCFC" : "#8E8E8E"} />
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#0B0B0B",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    borderTopColor: "#444444",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 60,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
  labelActive: {
    color: "#FCFCFC",
  },
  labelInactive: {
    color: "#8E8E8E",
  },
  pressed: {
    opacity: 0.8,
  },
});
