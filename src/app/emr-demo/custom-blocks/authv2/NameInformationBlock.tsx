import { FileText } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import type {
  BlockDefinition,
  ContentBlockItemProps,
  BlockRendererProps,
  BlockData,
} from "@/packages/survey-form-package/src/types";

import { themes } from "@/packages/survey-form-package/src/themes";
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext";
import { Input } from "@/packages/survey-form-package/src/components/ui/input";
import { Label } from "@/packages/survey-form-package/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/packages/survey-form-package/src/components/ui/select";
import { cn } from "@/packages/survey-form-package/src/lib/utils";
import { Card } from "@/packages/survey-form-package/src/components/ui/card";

// ============================================================================
// ERROR CONFIG
// ============================================================================

const ERROR_CONFIG = {
  firstName: "First name is required.",
  firstNameMin: "Name cannot be less than 2 characters.",
  firstNameMax: "Name cannot be more than 50 characters.",
  lastName: "Last name is required.",
  lastNameMin: "Last name cannot be less than 2 characters.",
  lastNameMax: "Last name cannot be more than 50 characters.",
  state: "State selection is required.",
} as const;

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "Washington D.C." },
];

// ============================================================================
// BLOCK IMPLEMENTATION
// ============================================================================

// Builder Form Component (for customizing block properties)
const NameInformationForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handle = (field: string, value: any) =>
    onUpdate?.({ ...data, [field]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fieldName">Field Name</Label>
        <Input
          id="fieldName"
          value={data.fieldName || ""}
          onChange={(e) => handle("fieldName", e.target.value)}
          placeholder="NameInformation"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for the medical review form.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="successRate">Success Rate</Label>
        <Input
          id="successRate"
          value={data.successRate || "94%"}
          onChange={(e) => handle("successRate", e.target.value)}
          placeholder="94%"
        />
      </div>
    </div>
  );
};

// Builder Palette Preview (shown in the blocks palette)
const NameInformationPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        Medical Review
      </div>
    </div>
  );
};

// Builder Item Preview (shown in the builder canvas)
const NameInformationItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4 text-center">
        Let's collect your basic information.
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>First Name</Label>
            <Input placeholder="First Name" disabled />
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            <Input placeholder="Last Name" disabled />
          </div>
        </div>
        <div className="space-y-2">
          <Label>What state will your medication be shipped to?</Label>
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder="Select the state" />
            </SelectTrigger>
          </Select>
        </div>
      </div>
      <p className="text-xs text-center mt-6 text-muted-foreground">
        Your information is never shared and is protected by HIPAA.
      </p>
    </Card>
  );
};

// Track which blocks have auto-skipped in this page session (clears on page reload)
const autoSkippedBlocks = new Set<string>();

// Renderer Component (shown to end users filling the form)
const NameInformationRenderer = React.forwardRef<
  HTMLDivElement,
  BlockRendererProps
>(({ block, value, onChange, onBlur, error, disabled, theme }, ref) => {
  const themeConfig = theme ?? themes.default;
  const { setValue, goToNextBlock, values, customData } = useSurveyForm();
  const [formData, setFormData] = useState({
    firstName: value?.firstName || "",
    lastName: value?.lastName || "",
    state: value?.state || "",
  });
  const hasCheckedPatient = useRef(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasSkippedOnce, setHasSkippedOnce] = useState(false);

  // Get enrollment module from customData
  const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule);

  // Use enrollment module's default storage key
  const storageKey = enrollmentModule?.getPatientAuthStorageKey();

  // Check for existing patient data on mount
  useEffect(() => {
    if (!enrollmentModule || hasCheckedPatient.current) return;

    hasCheckedPatient.current = true;

    const checkExistingPatient = async () => {
      try {
        // Check if auto-skip has already happened for this block in this session
        const autoSkipKey = `${block.fieldName}_${storageKey}`;
        if (autoSkippedBlocks.has(autoSkipKey)) {
          // Auto-skip already happened, don't do it again
          return;
        }

        const stored = enrollmentModule.getStoredPatientAuth(storageKey);

        if (stored?.patient?.firstName && stored?.patient?.lastName) {
          // Patient already has firstName and lastName, auto-skip
          const patientData = {
            firstName: stored.patient.firstName,
            lastName: stored.patient.lastName,
            state: value?.state || "", // Keep any existing state value from form
          };

          setFormData(patientData);
          setValue(block.fieldName as any, patientData);

          // Mark that auto-skip has happened for this block
          autoSkippedBlocks.add(autoSkipKey);

          // Skip to next block
          setTimeout(() => {
            goToNextBlock({ [block.fieldName as any]: patientData });
          }, 50);
        } else if (stored?.patient?.firstName || stored?.patient?.lastName) {
          // Partial data available, pre-fill but don't skip
          setFormData(prev => ({
            ...prev,
            firstName: stored.patient.firstName || prev.firstName,
            lastName: stored.patient.lastName || prev.lastName,
          }));
        }
      } catch (error) {
        console.error('[InfoBlock] Error checking existing patient:', error);
      }
    };

    checkExistingPatient();
  }, [enrollmentModule, storageKey, block.fieldName]);

  useEffect(() => {
    if (value) {
      setFormData({
        firstName: value?.firstName || "",
        lastName: value?.lastName || "",
        state: value?.state || "",
      });
    }
  }, [value]);

  const handleInputChange = (field: string, newValue: string) => {
    const updatedData = { ...formData, [field]: newValue };
    setFormData(updatedData);
    onChange?.(updatedData);
  };

  // Handle blur with patient update for firstName and lastName
  const handleFieldBlur = async (field: 'firstName' | 'lastName') => {
    if (onBlur) onBlur();

    // Update patient profile if enrollment module is available and field has value
    if (enrollmentModule && formData[field] && !isUpdating) {
      setIsUpdating(true);
      try {
        await enrollmentModule.updatePatientField(field, formData[field], storageKey);
      } catch (error) {
        console.error(`[InfoBlock] Error updating patient ${field}:`, error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const firstNameError =
    error === ERROR_CONFIG.firstName ||
    error === ERROR_CONFIG.firstNameMin ||
    error === ERROR_CONFIG.firstNameMax
      ? error
      : null;
  const lastNameError =
    error === ERROR_CONFIG.lastName ||
    error === ERROR_CONFIG.lastNameMin ||
    error === ERROR_CONFIG.lastNameMax
      ? error
      : null;
  const stateError = error === ERROR_CONFIG.state ? error : null;
  const hasGeneralError =
    error &&
    typeof error === "string" &&
    error !== ERROR_CONFIG.firstName &&
    error !== ERROR_CONFIG.firstNameMin &&
    error !== ERROR_CONFIG.firstNameMax &&
    error !== ERROR_CONFIG.lastName &&
    error !== ERROR_CONFIG.lastNameMin &&
    error !== ERROR_CONFIG.lastNameMax &&
    error !== ERROR_CONFIG.state;

  // --- Render ---
  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto" ref={ref}>
      <h2 className={cn("mb-6", themeConfig.title)}>
        Let's start with some basic information.
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`${block.fieldName}-firstName`}
            className={cn(
              "text-sm font-medium",
              themeConfig.field.label,
              "mb-2"
            )}
          >
            First Name
          </Label>
          <Input
            id={`${block.fieldName}-firstName`}
            value={formData.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
            placeholder="First Name"
            disabled={disabled || isUpdating}
            className={cn(themeConfig.field.input)}
            onBlur={() => handleFieldBlur('firstName')}
          />
          {firstNameError && (
            <p className={cn("text-sm font-medium", themeConfig.field.error)}>
              {firstNameError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`${block.fieldName}-lastName`}
            className={cn(
              "text-sm font-medium",
              themeConfig.field.label,
              "mb-2"
            )}
          >
            Last Name
          </Label>
          <Input
            id={`${block.fieldName}-lastName`}
            value={formData.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
            placeholder="Last Name"
            disabled={disabled || isUpdating}
            className={cn(themeConfig.field.input)}
            onBlur={() => handleFieldBlur('lastName')}
          />
          {lastNameError && (
            <p className={cn("text-sm font-medium", themeConfig.field.error)}>
              {lastNameError}
            </p>
          )}
        </div>
      </div>

      <p className={cn(themeConfig.description, "text-center mt-8")}>
        Your information is never shared and <br className="inline sm:hidden" />
        is protected by HIPAA.
      </p>

      {hasGeneralError && (
        <div
          className={cn(
            "text-sm font-medium mt-4 text-center",
            themeConfig.field.error
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
});
NameInformationRenderer.displayName = "NameInformationRenderer";

// Export the Block Definition
export const NameInformationBlock: BlockDefinition = {
  type: "nameInformation",
  name: "Name Collection",
  description:
    "Displays personal details and shipping state.",
  icon: <FileText className="w-4 h-4" />,
  defaultData: {
    type: "nameInformation",
    fieldName: "NameInformation",
    successRate: "94%",
  },
  renderItem: (props) => <NameInformationItem {...props} />,
  renderFormFields: (props) => <NameInformationForm {...props} />,
  renderPreview: () => <NameInformationPreview />,
  renderBlock: (props) => <NameInformationRenderer {...props} />,
  validate: (data: BlockData) => {
    if (!data.fieldName) return "Field name is required";
    return null;
  },
  validateValue: (value: any, data: BlockData) => {
    if (!value?.firstName) return ERROR_CONFIG.firstName;
    if (String(value?.firstName).length < 2) {
      return ERROR_CONFIG.firstNameMin;
    }
    if (String(value?.firstName).length > 50) {
      return ERROR_CONFIG.firstNameMax;
    }
    if (!value?.lastName) return ERROR_CONFIG.lastName;
    if (String(value?.lastName).length < 2) {
      return ERROR_CONFIG.lastNameMin;
    }
    if (String(value?.lastName).length > 50) {
      return ERROR_CONFIG.lastNameMax;
    }
    return null;
  },
  outputSchema: {
    type: "object",
    properties: {
      firstName: { type: "string" },
      lastName: { type: "string" },
      state: { type: "string" },
    },
  },
};