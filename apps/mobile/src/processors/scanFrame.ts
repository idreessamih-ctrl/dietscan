import { Frame } from "react-native-vision-camera";
import { NitroModules } from "react-native-nitro-modules";
import { TextRecognizer } from "react-native-vision-camera-ocr-plus";

export interface Barcode {
  value: string;
  type: string;
}

export interface ScanFrameResult {
  text: string;
  barcodes: Barcode[];
}

let recognizerInstance: TextRecognizer | null = null;

function getRecognizer(): TextRecognizer {
  "worklet";
  if (!recognizerInstance) {
    recognizerInstance = NitroModules.createHybridObject<TextRecognizer>("TextRecognizer");
    recognizerInstance.configure({
      language: "latin",
      frameSkipThreshold: 10,
      useLightweightMode: false,
    });
  }
  return recognizerInstance;
}

/**
 * Custom frame processor for Vision Camera to extract OCR text and detect barcodes.
 * Runs inside the Worklet runtime.
 */
export function scanFrame(frame: Frame): ScanFrameResult {
  "worklet";

  let detectedText = "";
  try {
    const recognizer = getRecognizer();
    const nb = frame.getNativeBuffer();
    const orientation = frame.orientation ?? "up";
    
    try {
      const ocrResult = recognizer.scanFrame(nb.pointer, orientation);
      if (ocrResult && typeof ocrResult.resultText === "string") {
        detectedText = ocrResult.resultText;
      }
    } finally {
      nb.release();
    }
  } catch (error) {
    console.log("[FrameProcessor] OCR error:", error);
  }

  // Parse barcodes from OCR text (match 8-13 digit sequences as fallback/support)
  const barcodes: Barcode[] = [];
  if (detectedText) {
    const matches = detectedText.match(/\b\d{8,13}\b/g);
    if (matches) {
      for (const val of matches) {
        barcodes.push({
          value: val,
          type: val.length === 8 ? "EAN-8" : "EAN-13",
        });
      }
    }
  }

  return {
    text: detectedText,
    barcodes,
  };
}
