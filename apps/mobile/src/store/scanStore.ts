import { create } from "zustand";
import { ComplianceReport } from "../lib/complianceEngine";

export interface ScanResult {
  id?: string;
  barcode?: string;
  name: string;
  brand: string | null;
  ingredients: string[];
  rawText?: string;
  complianceReport: ComplianceReport;
  nutritionFacts?: Record<string, unknown>;
  scannedAt: string;
}

interface ScanState {
  lastScan: ScanResult | null;
  scanHistory: ScanResult[];
  isScanning: boolean;
  complianceResults: Record<string, ComplianceReport>;
  startScan: () => void;
  setResult: (result: ScanResult) => void;
  clearLastScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  lastScan: null,
  scanHistory: [],
  isScanning: false,
  complianceResults: {},

  startScan: () => set({ isScanning: true, lastScan: null }),

  setResult: (result: ScanResult) =>
    set((state) => {
      const updatedHistory = [result, ...state.scanHistory].slice(0, 50); // limit history to last 50 items
      const updatedComplianceResults = {
        ...state.complianceResults,
        [result.barcode || result.name]: result.complianceReport,
      };

      return {
        lastScan: result,
        scanHistory: updatedHistory,
        isScanning: false,
        complianceResults: updatedComplianceResults,
      };
    }),

  clearLastScan: () => set({ lastScan: null, isScanning: false }),
}));
export type { ScanState };
