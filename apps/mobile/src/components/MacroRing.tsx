import { View, Text, StyleSheet } from "react-native";

interface MacroRingProps {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  value: string;
}

export const MacroRing = ({
  percentage,
  color,
  size = 90,
  strokeWidth = 8,
  label,
  value,
}: MacroRingProps) => {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  // Set colors for each quadrant based on progress
  const borderTopColor = clampedPercentage > 0 ? color : "#374151";
  const borderRightColor = clampedPercentage >= 25 ? color : "#374151";
  const borderBottomColor = clampedPercentage >= 50 ? color : "#374151";
  const borderLeftColor = clampedPercentage >= 75 ? color : "#374151";

  const outerSize = size;
  const innerSize = size - strokeWidth * 2;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.ringOuter,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: strokeWidth,
            borderTopColor,
            borderRightColor,
            borderBottomColor,
            borderLeftColor,
          },
        ]}
      >
        <View
          style={[
            styles.ringInner,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              top: -strokeWidth, // Adjust due to borderWidth
              left: -strokeWidth,
            },
          ]}
        >
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.percentageText}>{Math.round(clampedPercentage)}%</Text>
        </View>
      </View>
      <Text style={[styles.labelText, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  ringOuter: {
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  ringInner: {
    position: "absolute",
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111827",
  },
  valueText: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
  },
  percentageText: {
    color: "#9ca3af",
    fontSize: 10,
    marginTop: 1,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
});
