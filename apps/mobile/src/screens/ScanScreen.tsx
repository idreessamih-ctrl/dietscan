import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useCameraPermission, useCameraDevice } from "react-native-vision-camera";
import { Camera } from "react-native-vision-camera-ocr-plus";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { lookupBarcodeAndCheckCompliance } from "../lib/barcodeScanner";
import { normalizeOcrText } from "../lib/normalizeOcr";
import { evaluateCompliance } from "../lib/complianceEngine";
import { useScanStore } from "../store/scanStore";
import { useAuth } from "../store/useAuth";
import { RootStackParamList } from "../navigation/RootNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Main">;

export const ScanScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const activeProtocol = user?.dietaryProtocol || "keto";
  const { setResult, startScan } = useScanStore();

  // Camera settings
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">("back");
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const device = useCameraDevice(cameraPosition);

  // Scan modes: "barcode" or "ocr"
  const [scanMode, setScanMode] = useState<"barcode" | "ocr">("ocr");

  // Detection states
  const [detectedText, setDetectedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const isSearchingRef = useRef<boolean>(false);
  const activeOcrTextRef = useRef<string>("");

  // Reset scan state on mount/focus
  useEffect(() => {
    startScan();
    isSearchingRef.current = false;
    setIsProcessing(false);
  }, []);

  const handleBarcodeDetected = async (barcodeVal: string) => {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setIsProcessing(true);

    try {
      // Trigger haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await lookupBarcodeAndCheckCompliance(barcodeVal, activeProtocol);
      if (result) {
        setResult(result);
        navigation.navigate("ScanResult", { result });
      } else {
        Alert.alert(
          "Product Not Found",
          `Barcode ${barcodeVal} was not found on Open Food Facts database.`,
          [{ text: "OK", onPress: () => { isSearchingRef.current = false; setIsProcessing(false); } }]
        );
      }
    } catch (err) {
      console.error("[ScanScreen] Barcode search error:", err);
      isSearchingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleOcrCallback = (data: any) => {
    // data is RecognizedText: { resultText: string, blocks: TextBlock[] }
    const text = data?.resultText || "";
    activeOcrTextRef.current = text;

    if (text) {
      const preview = text.substring(0, 100) + (text.length > 100 ? "..." : "");
      setDetectedText(preview);

      // Auto-scan barcode if detected in barcode mode
      if (scanMode === "barcode") {
        const matches = text.match(/\b\d{8,13}\b/g);
        if (matches && matches.length > 0) {
          handleBarcodeDetected(matches[0]);
        }
      }
    } else {
      setDetectedText("");
    }
  };

  const handleCaptureOCR = async () => {
    const rawText = activeOcrTextRef.current;
    if (!rawText || rawText.trim().length === 0) {
      Alert.alert("No Text Detected", "Please align the ingredient label inside the scan region.");
      return;
    }

    setIsProcessing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Normalize raw OCR text into cleaned unique ingredients using the SQLite-backed pipeline
      const cleanedIngredients = await normalizeOcrText(rawText);

      // Evaluate compliance locally
      const complianceReport = await evaluateCompliance(activeProtocol, cleanedIngredients);

      const scanResult = {
        name: "Ingredient Label Scan",
        brand: null,
        ingredients: cleanedIngredients,
        rawText,
        complianceReport,
        scannedAt: new Date().toISOString(),
      };

      // Trigger success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setResult(scanResult);
      setIsProcessing(false);
      navigation.navigate("ScanResult", { result: scanResult });
    } catch (error) {
      console.error("[ScanScreen] OCR processing error:", error);
      setIsProcessing(false);
      Alert.alert("Scanning Error", "Failed to parse ingredient text. Please try again.");
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert("Permission Denied", "Camera permission is required to use scanner features.");
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionSubtitle}>
          DietScan requires access to your camera to scan barcodes and ingredient labels.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>No Camera Device Found</Text>
      </View>
    );
  }

  const OcrCamera = Camera as any;

  return (
    <View style={styles.container}>
      <OcrCamera
        style={styles.cameraFill}
        device={device}
        isActive={true}
        mode="recognize"
        options={{ language: "latin", frameSkipThreshold: 10 }}
        callback={handleOcrCallback}
        torch={isTorchOn ? "on" : "off"}
      />

      {/* Mode Selector Top */}
      <View style={styles.topControlBar}>
        <View style={styles.activeProtocolBadge}>
          <Text style={styles.protocolBadgeText}>Diet: {activeProtocol.toUpperCase()}</Text>
        </View>

        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === "ocr" && styles.activeModeButton]}
            onPress={() => {
              setScanMode("ocr");
              isSearchingRef.current = false;
            }}
          >
            <Text style={[styles.modeButtonText, scanMode === "ocr" && styles.activeModeButtonText]}>
              📝 OCR Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === "barcode" && styles.activeModeButton]}
            onPress={() => {
              setScanMode("barcode");
              setIsProcessing(false);
            }}
          >
            <Text style={[styles.modeButtonText, scanMode === "barcode" && styles.activeModeButtonText]}>
              🏷️ Barcode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scan Box Overlay */}
      <View style={styles.overlayContainer}>
        <View style={styles.unfocusedRegion} />
        <View style={styles.middleRow}>
          <View style={styles.unfocusedRegion} />
          {/* Active scan area */}
          <View style={[styles.focusBox, scanMode === "barcode" ? styles.barcodeBox : styles.ocrBox]}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <Text style={styles.focusBoxHelperText}>
              {scanMode === "ocr"
                ? "Align ingredient text here"
                : "Point at product barcode"}
            </Text>
          </View>
          <View style={styles.unfocusedRegion} />
        </View>
        <View style={styles.unfocusedRegion} />
      </View>

      {/* Scanning status/preview */}
      {detectedText.length > 0 && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Detected Text Preview:</Text>
          <Text style={styles.previewText} numberOfLines={2}>
            {detectedText}
          </Text>
        </View>
      )}

      {/* Processing Loader */}
      {isProcessing && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Analyzing ingredients...</Text>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={styles.bottomControlBar}>
        <TouchableOpacity
          style={styles.circleButtonSmall}
          onPress={() => setIsTorchOn((prev) => !prev)}
        >
          <Text style={styles.buttonIcon}>{isTorchOn ? "💡" : "🔦"}</Text>
        </TouchableOpacity>

        {scanMode === "ocr" ? (
          <TouchableOpacity style={styles.captureButton} onPress={handleCaptureOCR} disabled={isProcessing}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        ) : (
          <View style={styles.barcodeModePlaceholder}>
            <ActivityIndicator size="small" color="#10b981" />
            <Text style={styles.barcodePlaceholderText}>Scanning...</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.circleButtonSmall}
          onPress={() => setCameraPosition((prev) => (prev === "back" ? "front" : "back"))}
        >
          <Text style={styles.buttonIcon}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  permissionSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  topControlBar: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  activeProtocolBadge: {
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  protocolBadgeText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "bold",
  },
  modeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 17,
  },
  activeModeButton: {
    backgroundColor: "#10b981",
  },
  modeButtonText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "bold",
  },
  activeModeButtonText: {
    color: "#fff",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  unfocusedRegion: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    width: "100%",
  },
  middleRow: {
    flexDirection: "row",
    width: "100%",
  },
  focusBox: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "transparent",
  },
  ocrBox: {
    width: 280,
    height: 280,
  },
  barcodeBox: {
    width: 280,
    height: 120,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#10b981",
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  focusBoxHelperText: {
    position: "absolute",
    bottom: -32,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "rgba(17, 24, 39, 0.8)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  previewContainer: {
    position: "absolute",
    bottom: 110,
    left: 20,
    right: 20,
    backgroundColor: "rgba(17, 24, 39, 0.9)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#374151",
    zIndex: 10,
  },
  previewLabel: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  previewText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  loaderContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  loaderText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  bottomControlBar: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  circleButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  buttonIcon: {
    fontSize: 18,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10b981",
  },
  barcodeModePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  barcodePlaceholderText: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },
});
