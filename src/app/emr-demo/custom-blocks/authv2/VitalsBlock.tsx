import React, { useState, useEffect, useCallback, useRef } from "react";
import { Activity } from "lucide-react";

import type {
  BlockDefinition,
  ContentBlockItemProps,
  BlockRendererProps,
  BlockData,
} from "@/packages/survey-form-package/src/types";

import { Input } from "@/packages/survey-form-package/src/components/ui/input";
import { Label } from "@/packages/survey-form-package/src/components/ui/label";
import { Card } from "@/packages/survey-form-package/src/components/ui/card";
import { cn } from "@/packages/survey-form-package/src/lib/utils";
import { themes } from "@/packages/survey-form-package/src/themes";
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext";
import BMIChart from "./BMIInformationBlock";

// ============================================================================
// CONSTANTS
// ============================================================================

type VitalKey = "height" | "weight" | "systolic" | "diastolic" | "pulse" | "temperature" | "oxygen_saturation";

const ALL_VITAL_KEYS: VitalKey[] = [
  "height", "weight", "systolic", "diastolic", "pulse", "temperature", "oxygen_saturation",
];

const VITAL_DEFAULTS: Record<VitalKey, { label: string; placeholder: string; unit: string }> = {
  height: { label: "Height", placeholder: "5' 8\"", unit: "" },
  weight: { label: "Weight (lbs)", placeholder: "160", unit: "lbs" },
  systolic: { label: "Systolic (mmHg)", placeholder: "120", unit: "mmHg" },
  diastolic: { label: "Diastolic (mmHg)", placeholder: "80", unit: "mmHg" },
  pulse: { label: "Heart Rate (bpm)", placeholder: "72", unit: "bpm" },
  temperature: { label: "Temperature (\u00B0F)", placeholder: "98.6", unit: "\u00B0F" },
  oxygen_saturation: { label: "O\u2082 Saturation (%)", placeholder: "98", unit: "%" },
};

const calculateBMI = (feet: number, inches: number, weight: number) => {
  const totalInches = feet * 12 + (inches || 0);
  const heightMeters = totalInches * 0.0254;
  const weightKg = weight * 0.453592;
  if (heightMeters === 0 || weightKg === 0) return null;
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
};

// Track which blocks have auto-skipped in this page session
const autoSkippedBlocks = new Set<string>();

// ============================================================================
// HELPER: resolve configured vitals (always pair systolic+diastolic)
// ============================================================================

function resolveVitals(configuredVitals: string[]): VitalKey[] {
  const set = new Set<VitalKey>(configuredVitals as VitalKey[]);
  // If either BP field is present, include both
  if (set.has("systolic") || set.has("diastolic")) {
    set.add("systolic");
    set.add("diastolic");
  }
  // Maintain canonical order
  return ALL_VITAL_KEYS.filter((k) => set.has(k));
}

// ============================================================================
// BUILDER FORM
// ============================================================================

const VitalsBlockForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const handle = (field: string, value: any) => onUpdate?.({ ...data, [field]: value });

  const selectedVitals: string[] = data.vitals || ["height", "weight"];

  const toggleVital = (vital: string) => {
    const updated = selectedVitals.includes(vital)
      ? selectedVitals.filter((v: string) => v !== vital)
      : [...selectedVitals, vital];
    handle("vitals", updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={data.title || ""} onChange={(e) => handle("title", e.target.value)} placeholder="Let's record" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="titleHighlight">Title Highlight</Label>
        <Input id="titleHighlight" value={data.titleHighlight || ""} onChange={(e) => handle("titleHighlight", e.target.value)} placeholder="your vitals." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" value={data.description || ""} onChange={(e) => handle("description", e.target.value)} placeholder="Your vital signs help us..." />
      </div>
      <div className="space-y-2">
        <Label>Vitals to Collect</Label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_VITAL_KEYS.map((vital) => (
            <label key={vital} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={selectedVitals.includes(vital)} onChange={() => toggleVital(vital)} />
              {VITAL_DEFAULTS[vital].label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={data.showBmiChart !== false} onChange={(e) => handle("showBmiChart", e.target.checked)} />
          Show BMI Chart (when height & weight are configured)
        </label>
      </div>
    </div>
  );
};

// ============================================================================
// BUILDER ITEM PREVIEW
// ============================================================================

const VitalsBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  const vitals = resolveVitals(data.vitals || ["height", "weight"]);
  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-center text-lg font-semibold">
        {data.title || "Let's record"} {data.titleHighlight || "your vitals."}
      </h2>
      <p className="text-center text-sm text-muted-foreground">
        {data.description || "Your vital signs help us provide personalized care."}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {vitals.map((v) => (
          <div key={v} className={cn("space-y-1", v === "weight" && "col-span-2")}>
            <Label>{data[`${v}Label`] || VITAL_DEFAULTS[v].label}</Label>
            <Input disabled placeholder={VITAL_DEFAULTS[v].placeholder} />
          </div>
        ))}
      </div>
    </Card>
  );
};

// ============================================================================
// PALETTE PREVIEW
// ============================================================================

const VitalsBlockPreview: React.FC = () => (
  <div className="w-full flex items-center justify-center py-1">
    <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
      Vitals Collection (configurable)
    </div>
  </div>
);

// ============================================================================
// RENDERER
// ============================================================================

const VitalsRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, theme, onChange, error }, ref) => {
    const themeConfig = theme ?? themes.default;
    const { values, customData, goToNextBlock, setValue } = useSurveyForm();

    const [hasInteracted, setHasInteracted] = useState(false);
    const hasCheckedPatient = React.useRef(false);
    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule);
    const storageKey = enrollmentModule?.getPatientAuthStorageKey();

    const configuredVitals = resolveVitals(block.vitals || ["height", "weight"]);
    const hasHeight = configuredVitals.includes("height");
    const hasWeight = configuredVitals.includes("weight");
    const showBmi = block.showBmiChart !== false && hasHeight && hasWeight;

    // Build initial state from existing form values
    const fieldName = block.fieldName || "vitals";
    const existing = values?.[fieldName] || {};
    const [vitalValues, setVitalValues] = useState<Record<string, any>>({
      feet: existing.feet || "",
      inches: existing.inches ?? "",
      weight: existing.weight ?? "",
      systolic: existing.systolic ?? "",
      diastolic: existing.diastolic ?? "",
      pulse: existing.pulse ?? "",
      temperature: existing.temperature ?? "",
      oxygen_saturation: existing.oxygen_saturation ?? "",
      bmi: existing.bmi ?? null,
    });

    // Check for existing patient data on mount (auto-skip)
    useEffect(() => {
      if (!enrollmentModule || hasCheckedPatient.current) return;
      hasCheckedPatient.current = true;

      const checkExisting = async () => {
        try {
          const autoSkipKey = `${fieldName}_${storageKey}`;
          if (autoSkippedBlocks.has(autoSkipKey)) return;

          const stored = enrollmentModule.getStoredPatientAuth(storageKey);
          if (!stored?.patient) return;

          const patient = stored.patient;
          let allPresent = true;
          const prefilled: Record<string, any> = { ...vitalValues };

          for (const v of configuredVitals) {
            if (v === "height") {
              if (patient.height) {
                const h = Number(patient.height);
                const { feet, inches } = enrollmentModule.inchesToFeetInches(h);
                prefilled.feet = feet;
                prefilled.inches = inches;
              } else {
                allPresent = false;
              }
            } else if (v === "weight") {
              if (patient.weight) {
                prefilled.weight = Number(patient.weight);
              } else {
                allPresent = false;
              }
            } else {
              // For other vitals we don't auto-skip since patient model doesn't store them
              allPresent = false;
            }
          }

          if (hasHeight && prefilled.feet && hasWeight && prefilled.weight) {
            prefilled.bmi = calculateBMI(Number(prefilled.feet), Number(prefilled.inches) || 0, Number(prefilled.weight));
          }

          setVitalValues(prefilled);
          setValue(fieldName as any, prefilled);

          if (allPresent) {
            autoSkippedBlocks.add(autoSkipKey);

            // Store vital data for deferred creation after token validation
            const apiData: Record<string, any> = {};
            if (hasHeight && prefilled.feet) {
              const heightInches = enrollmentModule.feetInchesToInches(
                Number(prefilled.feet), Number(prefilled.inches) || 0
              );
              apiData.height = heightInches;
              apiData.height_unit = "in";
            }
            if (hasWeight && prefilled.weight) {
              apiData.weight = Number(prefilled.weight);
              apiData.weight_unit = "lbs";
            }
            if (Object.keys(apiData).length > 0) {
              enrollmentModule.setPendingVitalData(apiData);
            }

            setTimeout(() => {
              goToNextBlock({ [fieldName as any]: prefilled });
            }, 50);
          }
        } catch (err) {
          console.error("[VitalsBlock] Error checking existing patient:", err);
        }
      };

      checkExisting();
    }, [enrollmentModule, storageKey, fieldName]);

    const updateValue = useCallback(
      (key: string, value: any) => {
        setHasInteracted(true);

        setVitalValues((prev) => {
          const next = { ...prev, [key]: value };

          // Recalculate BMI if height/weight changed
          if (hasHeight && hasWeight) {
            const feet = Number(next.feet) || 0;
            const inches = Number(next.inches) || 0;
            const weight = Number(next.weight) || 0;
            next.bmi = feet > 0 && weight > 0 ? calculateBMI(feet, inches, weight) : null;
          }

          onChange?.(next);

          // Debounced API update
          if (enrollmentModule) {
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

            updateTimeoutRef.current = setTimeout(() => {
              const apiData: Record<string, any> = {};

              if (hasHeight) {
                const f = Number(next.feet) || 0;
                const i = Number(next.inches) || 0;
                if (f > 0) {
                  const heightInches = enrollmentModule.feetInchesToInches(f, i);
                  apiData.height = heightInches;
                  apiData.height_unit = "in";
                  // Also update patient profile for backward compat
                  enrollmentModule.updatePatientField("height", heightInches, storageKey)
                    .catch((e: any) => console.error("[VitalsBlock] Error updating patient height:", e));
                }
              }
              if (hasWeight && Number(next.weight) > 0) {
                apiData.weight = Number(next.weight);
                apiData.weight_unit = "lbs";
                enrollmentModule.updatePatientField("weight", Number(next.weight), storageKey)
                  .catch((e: any) => console.error("[VitalsBlock] Error updating patient weight:", e));
              }
              if (configuredVitals.includes("systolic") && next.systolic) {
                apiData.systolic = Number(next.systolic);
              }
              if (configuredVitals.includes("diastolic") && next.diastolic) {
                apiData.diastolic = Number(next.diastolic);
              }
              if (configuredVitals.includes("pulse") && next.pulse) {
                apiData.pulse = Number(next.pulse);
              }
              if (configuredVitals.includes("temperature") && next.temperature) {
                apiData.temperature = Number(next.temperature);
                apiData.temperature_unit = "F";
              }
              if (configuredVitals.includes("oxygen_saturation") && next.oxygen_saturation) {
                apiData.oxygen_saturation = Number(next.oxygen_saturation);
              }

              if (Object.keys(apiData).length > 0) {
                enrollmentModule.setPendingVitalData(apiData);
              }
            }, 500);
          }

          return next;
        });
      },
      [enrollmentModule, storageKey, onChange, hasHeight, hasWeight, configuredVitals]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      };
    }, []);

    // Group vitals for rendering
    const hasBloodPressure = configuredVitals.includes("systolic");
    const otherVitals = configuredVitals.filter(
      (v) => !["height", "weight", "systolic", "diastolic"].includes(v)
    );

    return (
      <div
        className="relative w-full max-w-2xl flex flex-col gap-8 sm:gap-10 items-center min-h-[70svh] mx-auto"
        ref={ref}
      >
        {/* Title */}
        <div>
          <h2 className={cn("mb-2", themeConfig.title)}>
            {block.title}{" "}
            <span
              style={{
                background: `linear-gradient(to right, ${themeConfig.colors.secondary}, ${themeConfig.colors.primary})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {block.titleHighlight}
            </span>
          </h2>
          <p className={cn(themeConfig.description)}>{block.description}</p>
        </div>

        {/* BMI Chart */}
        {showBmi && (
          <BMIChart
            bmi={vitalValues.bmi as any}
            primaryColor={themeConfig.colors.primary}
            secondaryColor={themeConfig.colors.secondary}
          />
        )}

        {/* Height & Weight Section */}
        {(hasHeight || hasWeight) && (
          <div className="w-full space-y-4">
            {(hasHeight || hasWeight) && (
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: themeConfig.colors.secondary }}>
                  Height & Weight
                </span>
                <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              {hasHeight && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldName}.feet`} className={cn(themeConfig.field.label)}>
                      {block.heightLabel || "Height"} (ft)
                    </Label>
                    <Input
                      id={`${fieldName}.feet`}
                      placeholder="5"
                      type="number"
                      value={vitalValues.feet}
                      onChange={(e) => updateValue("feet", e.target.value)}
                      className={cn(themeConfig.field.input)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldName}.inches`} className={cn(themeConfig.field.label)}>
                      {block.heightLabel || "Height"} (in)
                    </Label>
                    <Input
                      id={`${fieldName}.inches`}
                      placeholder="8"
                      type="number"
                      value={vitalValues.inches}
                      onChange={(e) => updateValue("inches", e.target.value)}
                      className={cn(themeConfig.field.input)}
                    />
                  </div>
                </>
              )}
              {hasWeight && (
                <div className={cn("flex flex-col gap-2", hasHeight ? "col-span-2 mt-2" : "col-span-2")}>
                  <Label htmlFor={`${fieldName}.weight`} className={cn(themeConfig.field.label)}>
                    {block.weightLabel || "Weight (lbs)"}
                  </Label>
                  <Input
                    id={`${fieldName}.weight`}
                    placeholder="160"
                    type="number"
                    value={vitalValues.weight}
                    onChange={(e) => updateValue("weight", e.target.value)}
                    className={cn(themeConfig.field.input)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blood Pressure Section */}
        {hasBloodPressure && (
          <div className="w-full space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: themeConfig.colors.secondary }}>
                Blood Pressure
              </span>
              <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
            </div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldName}.systolic`} className={cn(themeConfig.field.label)}>
                  {block.systolicLabel || "Systolic (mmHg)"}
                </Label>
                <Input
                  id={`${fieldName}.systolic`}
                  placeholder="120"
                  type="number"
                  value={vitalValues.systolic}
                  onChange={(e) => updateValue("systolic", e.target.value)}
                  className={cn(themeConfig.field.input)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldName}.diastolic`} className={cn(themeConfig.field.label)}>
                  {block.diastolicLabel || "Diastolic (mmHg)"}
                </Label>
                <Input
                  id={`${fieldName}.diastolic`}
                  placeholder="80"
                  type="number"
                  value={vitalValues.diastolic}
                  onChange={(e) => updateValue("diastolic", e.target.value)}
                  className={cn(themeConfig.field.input)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Other Vitals Section */}
        {otherVitals.length > 0 && (
          <div className="w-full space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: themeConfig.colors.secondary }}>
                Other Vitals
              </span>
              <div className="h-px grow" style={{ backgroundColor: themeConfig.colors.border }} />
            </div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              {otherVitals.map((v) => (
                <div key={v} className="flex flex-col gap-2">
                  <Label htmlFor={`${fieldName}.${v}`} className={cn(themeConfig.field.label)}>
                    {block[`${v}Label`] || VITAL_DEFAULTS[v].label}
                  </Label>
                  <Input
                    id={`${fieldName}.${v}`}
                    placeholder={VITAL_DEFAULTS[v].placeholder}
                    type="number"
                    step={v === "temperature" ? "0.1" : "1"}
                    value={vitalValues[v]}
                    onChange={(e) => updateValue(v, e.target.value)}
                    className={cn(themeConfig.field.input)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Error */}
        {error && hasInteracted && (
          <div className={cn("text-sm font-medium mt-2 text-center", themeConfig.field.error)}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

VitalsRenderer.displayName = "VitalsRenderer";

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

export const VitalsInformationBlock: BlockDefinition = {
  type: "bmiInformation",
  name: "Vitals Information",
  description: "Collects configurable vital signs (height, weight, blood pressure, heart rate, etc.)",
  icon: <Activity className="w-4 h-4" />,
  defaultData: {
    type: "bmiInformation",
    title: "Let's record",
    titleHighlight: "your vitals.",
    fieldName: "vitals",
    description: "Your vital signs help us provide personalized care recommendations.",
    vitals: ["height", "weight"],
    showBmiChart: true,
    heightLabel: "Height",
    weightLabel: "Weight (lbs)",
    systolicLabel: "Systolic (mmHg)",
    diastolicLabel: "Diastolic (mmHg)",
    pulseLabel: "Heart Rate (bpm)",
    temperatureLabel: "Temperature (\u00B0F)",
    oxygenSaturationLabel: "O\u2082 Saturation (%)",
  },
  renderItem: (props) => <VitalsBlockItem {...props} />,
  renderFormFields: (props) => <VitalsBlockForm {...props} />,
  renderPreview: () => <VitalsBlockPreview />,
  renderBlock: (props) => <VitalsRenderer {...props} />,
  validateValue: (value: any, data: BlockData) => {
    const vitals = resolveVitals((data as any).vitals || ["height", "weight"]);

    if (vitals.includes("height") && !value?.feet) {
      return `${(data as any).heightLabel || "Height"} is required.`;
    }
    if (vitals.includes("weight") && !value?.weight) {
      return `${(data as any).weightLabel || "Weight"} is required.`;
    }
    if (vitals.includes("systolic") && (!value?.systolic || !value?.diastolic)) {
      return "Both systolic and diastolic blood pressure are required.";
    }
    if (vitals.includes("pulse") && !value?.pulse) {
      return `${(data as any).pulseLabel || "Heart rate"} is required.`;
    }
    if (vitals.includes("temperature") && !value?.temperature) {
      return `${(data as any).temperatureLabel || "Temperature"} is required.`;
    }
    if (vitals.includes("oxygen_saturation") && !value?.oxygen_saturation) {
      return `${(data as any).oxygenSaturationLabel || "O\u2082 Saturation"} is required.`;
    }

    // Range validations
    const feet = Number(value?.feet);
    const weight = Number(value?.weight);
    if (vitals.includes("height") && feet <= 0) return "Please enter a valid height.";
    if (vitals.includes("weight") && weight <= 0) return "Please enter a valid weight.";

    const sys = Number(value?.systolic);
    const dia = Number(value?.diastolic);
    if (vitals.includes("systolic") && (sys < 40 || sys > 300)) return "Systolic must be between 40-300 mmHg.";
    if (vitals.includes("diastolic") && (dia < 20 || dia > 200)) return "Diastolic must be between 20-200 mmHg.";

    const pulse = Number(value?.pulse);
    if (vitals.includes("pulse") && (pulse < 20 || pulse > 250)) return "Heart rate must be between 20-250 bpm.";

    const temp = Number(value?.temperature);
    if (vitals.includes("temperature") && (temp < 85 || temp > 115)) return "Temperature must be between 85-115\u00B0F.";

    const o2 = Number(value?.oxygen_saturation);
    if (vitals.includes("oxygen_saturation") && (o2 < 50 || o2 > 100)) return "O\u2082 saturation must be between 50-100%.";

    return null;
  },
  outputSchema: {
    type: "object",
    properties: {
      feet: { type: "number", optional: true, description: "Height feet" },
      inches: { type: "number", optional: true, description: "Height inches" },
      weight: { type: "number", optional: true, description: "Weight in lbs" },
      bmi: { type: "number", optional: true, description: "Calculated BMI" },
      systolic: { type: "number", optional: true, description: "Systolic BP" },
      diastolic: { type: "number", optional: true, description: "Diastolic BP" },
      pulse: { type: "number", optional: true, description: "Heart rate" },
      temperature: { type: "number", optional: true, description: "Temperature" },
      oxygen_saturation: { type: "number", optional: true, description: "O2 saturation" },
    },
  },
};
