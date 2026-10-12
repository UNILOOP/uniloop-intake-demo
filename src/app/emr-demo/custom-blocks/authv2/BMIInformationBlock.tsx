import React, { useState, useEffect, useCallback } from "react";
import { Calculator } from "lucide-react";

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

// ============================================================================
// HELPER UTILITIES
// ============================================================================

const calculateBMI = (feet: number, inches: number, weight: number) => {
  const totalInches = feet * 12 + (inches || 0);
  const heightMeters = totalInches * 0.0254;
  const weightKg = weight * 0.453592;

  if (heightMeters === 0 || weightKg === 0) return null;

  const bmi = Number((weightKg / (heightMeters * heightMeters)).toFixed(1));

  return bmi;
};

const R = 170; // Radius from the SVG path 'A 170 170...'
const circumference = Math.PI * R; // Half circle circumference
const maxBMI = 50;

// Track which blocks have auto-skipped in this page session (clears on page reload)
const autoSkippedBlocks = new Set<string>();

const BMIChart = ({
  bmi,
  primaryColor,
  secondaryColor,
}: {
  bmi?: number;
  primaryColor: string;
  secondaryColor: string;
}) => {
  // We only need one state: the final offset.
  // Initialize it to the full circumference (which means 0% progress).
  const [strokeDashoffset, setStrokeDashoffset] = useState(circumference);

  // This single effect runs whenever 'bmi' changes.
  useEffect(() => {
    // 1. Calculate the progress percentage (0-100)
    const progressPercent = Math.min((bmi || 0) / maxBMI, 1);

    // 2. Calculate the new offset based on the progress
    // We subtract the progress from the total circumference
    const newOffset = circumference - circumference * progressPercent;

    // 3. Set the new offset. The CSS transition will handle the animation.
    setStrokeDashoffset(newOffset);
  }, [bmi]); // <-- The dependency is [bmi]

  return (
    <div className="relative w-full aspect-2/1 sm:w-[400px] flex items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 420 210"
        fill="none"
        className="block"
      >
        {/* Background Path */}
        <path
          d="M 30 190
          A 170 170 0 0 1 370 190"
          stroke="#FFFFFF"
          strokeWidth={22}
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
          style={{
            WebkitFilter: "drop-shadow(0px 4px 15.7px rgba(28, 28, 28, 0.05))",
            filter: "drop-shadow(0px 4px 15.7px rgba(28, 28, 28, 0.05))",
          }}
        />
        <defs>
          <linearGradient
            id="bmi-gradient"
            x1="30"
            y1="190"
            x2="370"
            y2="190"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={primaryColor} />
            <stop offset="1" stopColor={secondaryColor} />
          </linearGradient>
        </defs>

        {/* Foreground (Animated) Path */}
        <path
          d="M 30 190
          A 170 170 0 0 1 370 190"
          stroke="url(#bmi-gradient)"
          strokeWidth={22}
          strokeLinecap="round"
          fill="none"
          className="shadow-[0_4px_16px_rgba(28,28,28,0.05)]"
          // strokeDasharray is constant, no need for state
          strokeDasharray={circumference}
          // strokeDashoffset is updated from our state
          strokeDashoffset={strokeDashoffset}
          style={{
            // This transition will animate the change in strokeDashoffset
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
            transformOrigin: "center",
            WebkitFilter: "drop-shadow(0px 4px 15.7px rgba(28, 28, 28, 0.05))",
            filter: "drop-shadow(0px 4px 15.7px rgba(28, 28, 28, 0.05))",
          }}
        />
      </svg>

      {/* Centered BMI Info */}
      <div className="absolute left-0 bottom-0 w-full h-full flex flex-col items-center justify-end pointer-events-none">
        <h4 className="title sm:mb-2 text-[1rem] sm:text-[1.5rem] leading-[28px] sm:leading-[32px] -tracking-[1%] text-center text-foreground font-normal">
          Your BMI
        </h4>
        <div
          className="text-3xl sm:text-5xl font-medium text-foreground"
          style={{ fontFamily: '"DM Sans", "Manrope", sans-serif' }}
        >
          {bmi?.toFixed(1) || 0}
        </div>
      </div>
    </div>
  );
};

export default BMIChart;

// ============================================================================
// BLOCK IMPLEMENTATION
// ============================================================================

// Builder Form Component
const BMIInformationBlockForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handle = (field: string, value: any) =>
    onUpdate?.({ ...data, [field]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title (h2)</Label>
        <Input
          id="title"
          value={data.title || ""}
          onChange={(e) => handle("title", e.target.value)}
          placeholder="Let's calculate"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title Highlight (h2)</Label>
        <Input
          id="title"
          value={data.titleHighlight || ""}
          onChange={(e) => handle("titleHighlight", e.target.value)}
          placeholder="your BMI."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (p)</Label>
        <Input
          id="description"
          value={data.description || ""}
          onChange={(e) => handle("description", e.target.value)}
          placeholder="Body Mass Index (BMI) helps determine..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="feetLabel">Feet Label</Label>
          <Input
            id="feetLabel"
            value={data.feetLabel || ""}
            onChange={(e) => handle("feetLabel", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inchesLabel">Inches Label</Label>
          <Input
            id="inchesLabel"
            value={data.inchesLabel || ""}
            onChange={(e) => handle("inchesLabel", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="weightLabel">Weight Label</Label>
        <Input
          id="weightLabel"
          value={data.weightLabel || ""}
          onChange={(e) => handle("weightLabel", e.target.value)}
        />
      </div>
    </div>
  );
};

// Builder Item Preview
const BMIInformationBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-center text-lg font-semibold">
        {data.title || "Let's calculate your BMI."}
      </h2>
      <p className="text-center text-sm text-muted-foreground">
        {data.description || "Body Mass Index (BMI) helps determine..."}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        <div className="space-y-1">
          <Label>{data.feetLabel || "Feet"}</Label>
          <Input disabled placeholder="5" />
        </div>
        <div className="space-y-1">
          <Label>{data.inchesLabel || "Inches"}</Label>
          <Input disabled placeholder="4" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>{data.weightLabel || "Weight (lbs)"}</Label>
          <Input disabled placeholder="200" />
        </div>
      </div>
      <div className="p-4 bg-primary/10 rounded-lg">
        <p className="text-sm text-center text-primary">
          BMI Result will be shown here
        </p>
      </div>
    </Card>
  );
};

// Builder Palette Preview
const BMIInformationBlockPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        BMI Calculator (Speedometer style)
      </div>
    </div>
  );
};

// Renderer Component
const BMIInformationRenderer = React.forwardRef<
  HTMLDivElement,
  BlockRendererProps
>(({ block, theme, onChange, error }, ref) => {
  const themeConfig = theme ?? themes.default;
  const { values, customData, goToNextBlock, setValue } = useSurveyForm();

  const [hasInteracted, setHasInteracted] = useState(false);
  const hasCheckedPatient = React.useRef(false);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Get enrollment module from customData
  const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule);

  // Use enrollment module's default storage key
  const storageKey = enrollmentModule?.getPatientAuthStorageKey();

  const [bmiValues, setBMIValues] = useState({
    feet: values?.bmi?.feet ? values?.bmi?.feet : 5,
    inches: values?.bmi?.inches ? values?.bmi?.inches : "",
    weight: values?.bmi?.weight ? values?.bmi?.weight : "",
    bmi: values?.bmi?.bmi ? values?.bmi?.bmi : null,
  });

  // Check for existing patient data on mount
  useEffect(() => {
    if (!enrollmentModule || hasCheckedPatient.current) return;

    hasCheckedPatient.current = true;

    const checkExistingPatient = async () => {
      try {
        // Check if auto-skip has already happened for this block in this page session
        const autoSkipKey = `${block.fieldName}_${storageKey}`;
        if (autoSkippedBlocks.has(autoSkipKey)) {
          // Auto-skip already happened, don't do it again
          return;
        }

        const stored = enrollmentModule.getStoredPatientAuth(storageKey);

        if (stored?.patient?.height && stored?.patient?.weight) {
          // Patient already has height and weight, convert and auto-fill
          const heightInInches = Number(stored.patient.height);
          const { feet, inches } = enrollmentModule.inchesToFeetInches(heightInInches);
          const weight = Number(stored.patient.weight);

          const patientBMIData = {
            feet,
            inches,
            weight,
            bmi: calculateBMI(feet, inches, weight),
          };

          setValue(block.fieldName as any, patientBMIData);
          setBMIValues(patientBMIData);

          // Mark that auto-skip has happened for this block
          autoSkippedBlocks.add(autoSkipKey);

          // Skip to next block
          setTimeout(() => {
            goToNextBlock({ [block.fieldName as any]: patientBMIData });
          }, 50);
        }
      } catch (error) {
        console.error('[BMI3Block] Error checking existing patient:', error);
      }
    };

    checkExistingPatient();
  }, [enrollmentModule, storageKey, block.fieldName]);

  const updateBMIValues = useCallback(
    (key: any, value: any) => {
      setHasInteracted(true);

      // Use functional update to avoid including bmiValues in dependencies
      setBMIValues((prev) => {
        const newData = { ...prev, [key]: value };

        // Calculate BMI immediately
        const feet = Number(newData.feet) || 0;
        const inches = Number(newData.inches) || 0;
        const weight = Number(newData.weight) || 0;
        const newBMI = feet > 0 && weight > 0 ? calculateBMI(feet, inches, weight) : null;

        const fullData = { ...newData, bmi: newBMI };

        // Call onChange with complete data including BMI
        onChange?.(fullData);

        // Fire off patient update in background (debounced)
        if (enrollmentModule) {
          // Clear any pending update
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }

          // Schedule new update
          updateTimeoutRef.current = setTimeout(() => {
            if (feet > 0 && weight > 0) {
              // Fire and forget - don't wait for this
              const heightInInches = enrollmentModule.feetInchesToInches(feet, inches);
              enrollmentModule.updatePatientField('height', heightInInches, storageKey)
                .catch((error: any) => console.error('[BMIInformationBlock] Error updating height:', error));
              enrollmentModule.updatePatientField('weight', weight, storageKey)
                .catch((error: any) => console.error('[BMIInformationBlock] Error updating weight:', error));
            }
          }, 500);
        }

        return fullData;
      });
    },
    [enrollmentModule, storageKey, onChange]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full max-w-2xl flex flex-col gap-8 sm:gap-10 items-center min-h-[70svh] mx-auto"
      ref={ref}
    >
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

      <BMIChart
        bmi={bmiValues.bmi as any}
        primaryColor={themeConfig.colors.primary}
        secondaryColor={themeConfig.colors.secondary}
      />

      <div className="grid grid-cols-2 gap-y-6 gap-x-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`bmi.feet`} className={cn(themeConfig.field.label)}>
            {block.feetLabel}
          </Label>
          <Input
            id="bmi.feet"
            name="bmi.feet"
            placeholder="5"
            type="number"
            value={bmiValues.feet}
            onChange={(e) => updateBMIValues("feet", e.target.value)}
            className={cn(themeConfig.field.input)}
            required={true}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`bmi.inches`} className={cn(themeConfig.field.label)}>
            {block.inchesLabel}
          </Label>
          <Input
            id="bmi.inches"
            name="bmi.inches"
            placeholder="4"
            type="number"
            value={bmiValues.inches}
            onChange={(e) => updateBMIValues("inches", e.target.value)}
            className={cn(themeConfig.field.input)}
          />
        </div>

        <div className="flex flex-col gap-2 col-span-2 mt-4">
          <Label htmlFor={`bmi.weight`} className={cn(themeConfig.field.label)}>
            {block.weightLabel}
          </Label>
          <Input
            id="bmi.weight"
            name="bmi.weight"
            placeholder="200"
            type="number"
            value={bmiValues.weight}
            onChange={(e) => updateBMIValues("weight", e.target.value)}
            className={cn(themeConfig.field.input)}
            required={true}
          />
        </div>
      </div>

      {/* Display Error from validation - only show after user interaction */}
      {error && hasInteracted && (
        <div
          className={cn(
            "text-sm font-medium mt-2 text-center",
            themeConfig.field.error
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
});

BMIInformationRenderer.displayName = "BMIInformationRenderer";

// Export the Block Definition
export const BMIInformationBlock: BlockDefinition = {
  type: "bmiInformation",
  name: "BMI Information",
  description: "Calculates BMI from height and weight inputs.",
  icon: <Calculator className="w-4 h-4" />,
  defaultData: {
    type: "bmiInformation",
    title: "Let's calculate",
    titleHighlight: "your BMI.",
    fieldName: "bmi",
    description:
      "Body Mass Index (BMI) helps determine eligibility for weight loss medication and assess weight-related health risks.",
    feetLabel: "Feet",
    inchesLabel: "Inches",
    weightLabel: "Weight (lbs)",
  },
  renderItem: (props) => <BMIInformationBlockItem {...props} />,
  renderFormFields: (props) => <BMIInformationBlockForm {...props} />,
  renderPreview: () => <BMIInformationBlockPreview />,
  renderBlock: (props) => <BMIInformationRenderer {...props} />,
  validateValue: (value: any, data: BlockData) => {
    // FIX: Validate the 'value' object, not 'data'
    if (!value?.feet) return `${data.feetLabel || "Feet"} is required.`;
    if (!value?.weight) return `${data.weightLabel || "Weight"} is required.`;

    const hf = Number(value?.feet);
    const w = Number(value?.weight);
    if (hf <= 0) return `Please enter a valid height.`;
    if (w <= 0) return `Please enter a valid weight.`;
    return null;
  },
  outputSchema: {
    type: "object",
    properties: {
      feet: { type: "number", optional: true, description: "Feet of the user" },
      inches: {
        type: "number",
        optional: true,
        description: "Inches of the user",
      },
      weight: {
        type: "number",
        optional: true,
        description: "weight of the user",
      },
      bmi: { type: "number", optional: true, description: "bmi of the user" },
    },
  },
};