import React, { forwardRef, useState, useEffect, useRef } from "react";
import { Check, Mail, Phone } from "lucide-react";

import type {
  AnswerViewProps,
  BlockDefinition,
  ContentBlockItemProps,
  BlockRendererProps,
  BlockData,
  ThemeDefinition,
} from "@/packages/survey-form-package/src/types";
import { AnswerFields, phoneText, textOf } from "../AnswerFields";

import { themes } from "@/packages/survey-form-package/src/themes";
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext";
import { useSurveyBuilder } from "@/packages/survey-form-package/src/context/SurveyBuilderContext";
import { Input } from "@/packages/survey-form-package/src/components/ui/input";
import { Label } from "@/packages/survey-form-package/src/components/ui/label";
import { Card } from "@/packages/survey-form-package/src/components/ui/card";
import { cn } from "@/packages/survey-form-package/src/lib/utils";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/packages/survey-form-package/src/components/ui/select";

const Cbox = React.memo(
  ({
    className,
    checked,
    themeConfig,
    ...props
  }: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
    themeConfig: ThemeDefinition;
  }) => {
    return (
      <CheckboxPrimitive.Root
        className={cn(themeConfig.field.checkbox, className)}
        checked={checked}
        style={{
          padding: "0.6px", // border thickness
          background: `linear-gradient(to right, ${themeConfig.colors.secondary}, ${themeConfig.colors.primary})`,
          WebkitMask: checked
            ? "none"
            : "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: checked ? "exclude" : "xor",
          maskComposite: checked ? "exclude" : "xor",
        }}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn("flex items-center justify-center text-white")}
        >
          <Check className="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Helper function to safely access nested object properties using dot notation
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

// Phone number masking utility
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const phoneNumber = value.replace(/\D/g, "");

  // Don't format if empty
  if (!phoneNumber) return "";

  // Limit to 10 digits, but still format it
  const limitedPhone =
    phoneNumber.length > 10 ? phoneNumber.slice(0, 10) : phoneNumber;

  // Format based on length
  if (limitedPhone.length <= 3) {
    return `(${limitedPhone}`;
  } else if (limitedPhone.length <= 6) {
    return `(${limitedPhone.slice(0, 3)}) ${limitedPhone.slice(3)}`;
  } else {
    return `(${limitedPhone.slice(0, 3)}) ${limitedPhone.slice(
      3,
      6
    )}-${limitedPhone.slice(6)}`;
  }
};

// Email validation utility
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[\w-\.+]+@([\w-]+\.)+[\w-]{2,4}$/;
  return emailRegex.test(email);
};

// Phone validation utility
const validatePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone.length === 10;
};

// ============================================================================
// BLOCK IMPLEMENTATION
// ============================================================================

// Builder Form Component (for customizing block properties)
const AuthInformationForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handle = (field: string, value: any) =>
    onUpdate?.({ ...data, [field]: value });

  const { getAvailableFieldsBefore } = useSurveyBuilder();

  const intakeFields = React.useMemo(() => {
    const currentBlockId = data.uuid || data.fieldName;
    return getAvailableFieldsBefore(currentBlockId);
  }, [data.uuid, data.fieldName, getAvailableFieldsBefore]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="fieldName">Field Name</Label>
        <Input
          id="fieldName"
          value={data.fieldName || ""}
          onChange={(e) => handle("fieldName", e.target.value)}
          placeholder="AuthInformation"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for storing responses
        </p>
      </div>

      {/* Content Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Content</h3>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={data.title || ""}
            onChange={(e) => handle("title", e.target.value)}
            placeholder="How can you be reached if necessary?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={data.description || ""}
            onChange={(e) => handle("description", e.target.value)}
            placeholder="Our medical teams and pharmacy use email and text for patient communication."
            className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacyText">Privacy Agreement Text</Label>
          <textarea
            id="privacyText"
            value={data.privacyText || ""}
            onChange={(e) => handle("privacyText", e.target.value)}
            placeholder="I understand that my information is never shared..."
            className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Use "our platform" as a placeholder - it will be replaced with the merchant's business name at runtime
          </p>
        </div>
      </div>

      {/* Labels Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Field Labels</h3>

        <div className="space-y-2">
          <Label htmlFor="emailLabel">Email Label</Label>
          <Input
            id="emailLabel"
            value={data.emailLabel || ""}
            onChange={(e) => handle("emailLabel", e.target.value)}
            placeholder="Email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneLabel">Phone Label</Label>
          <Input
            id="phoneLabel"
            value={data.phoneLabel || ""}
            onChange={(e) => handle("phoneLabel", e.target.value)}
            placeholder="Phone Number"
          />
        </div>
      </div>

      {/* Error Messages Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Validation Messages</h3>

        <div className="space-y-2">
          <Label htmlFor="emailRequiredError">Email Required Error</Label>
          <Input
            id="emailRequiredError"
            value={data.emailRequiredError || ""}
            onChange={(e) => handle("emailRequiredError", e.target.value)}
            placeholder="Email is required"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailInvalidError">Email Invalid Error</Label>
          <Input
            id="emailInvalidError"
            value={data.emailInvalidError || ""}
            onChange={(e) => handle("emailInvalidError", e.target.value)}
            placeholder="Please enter a valid email address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneRequiredError">Phone Required Error</Label>
          <Input
            id="phoneRequiredError"
            value={data.phoneRequiredError || ""}
            onChange={(e) => handle("phoneRequiredError", e.target.value)}
            placeholder="Phone number is required"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneInvalidError">Phone Invalid Error</Label>
          <Input
            id="phoneInvalidError"
            value={data.phoneInvalidError || ""}
            onChange={(e) => handle("phoneInvalidError", e.target.value)}
            placeholder="Please enter a valid 10-digit phone number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacyRequiredError">Privacy Required Error</Label>
          <Input
            id="privacyRequiredError"
            value={data.privacyRequiredError || ""}
            onChange={(e) => handle("privacyRequiredError", e.target.value)}
            placeholder="You must agree to continue"
          />
        </div>
      </div>
    </div>
  );
};

// Builder Item Preview (shown in the builder canvas)
const AuthInformationItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  return (
    <Card className="space-y-3 p-4 text-center">
      <h2 className="text-lg font-bold">
        {data.title || "How can you be reached if necessary?"}
      </h2>
      <p className="text-sm text-gray-600">
        {data.description || "Our medical teams and pharmacy use email and text for patient communication."}
      </p>
      <div className="text-left space-y-4 pt-4">
        <div>
          <Label>{data.emailLabel || "Email"}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
            <Input disabled placeholder="Enter your email" className="pl-10" />
          </div>
        </div>
        <div>
          <Label>{data.phoneLabel || "Phone Number"}</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
            <Input
              disabled
              placeholder="Enter your phone number"
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-start space-x-2 pt-2">
          <div className="w-4 h-4 rounded-full bg-white border border-gray-300" />
          <p className="text-xs text-gray-600 leading-relaxed">
            {data.privacyText || "I understand that my information is never shared, is protected by HIPAA and agree to the terms and privacy policies and to be contacted as necessary by our platform and its medical partners and can opt-out at anytime."}
          </p>
        </div>
      </div>
    </Card>
  );
};

// Builder Palette Preview (shown in the blocks palette)
const AuthInformationPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        Contact Information
      </div>
    </div>
  );
};

type AuthInformationRendererProps = Omit<
  BlockRendererProps,
  "error" | "value" | "onChange"
> & {
  error?: {
    email?: string;
    phone?: string;
    privacyAgreed?: string;
  };
  value?: {
    email: string;
    phone: string;
    privacyAgreed: boolean;
  };
  onChange?: (value: {
    email: string;
    phone: string;
    privacyAgreed: boolean;
  }) => void;
};

// Renderer Component (shown to end users filling the form)
const AuthInformationRenderer = forwardRef<
  HTMLDivElement,
  AuthInformationRendererProps
>(({ block, value, onChange, onBlur, error, disabled, theme }, ref) => {
  const themeConfig = theme ?? themes.default;
  const { values, customData } = useSurveyForm();
  const hasCheckedPatient = useRef(false);

  const [touchedFields, setTouchedFields] = useState<{
    email: boolean;
    phone: boolean;
    privacyAgreed: boolean;
  }>({ email: false, phone: false, privacyAgreed: false });

  // Handle form data structure
  const formData = value || { email: "", phone: "", privacyAgreed: false };

  // Get enrollment module from customData
  const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule);

  // Use enrollment module's default storage key
  const storageKey = enrollmentModule?.getPatientAuthStorageKey();

  // Get merchant business name for dynamic text replacement
  const merchantName = enrollmentModule?.merchant?.business?.name;

  // Check for existing patient data on mount to pre-fill
  useEffect(() => {
    if (!enrollmentModule || hasCheckedPatient.current) return;

    hasCheckedPatient.current = true;

    const checkExistingPatient = async () => {
      try {
        const stored = enrollmentModule.getStoredPatientAuth(storageKey);

        if (stored?.patient) {
          // Pre-fill email and/or phone if available
          const email = stored.patient.email || formData.email;
          // Store raw phone digits (remove any formatting from stored data)
          const phone = stored.patient.phone
            ? stored.patient.phone.replace(/\D/g, '')
            : formData.phone;

          // Only update if we have new data
          if (email || phone) {
            onChange?.({
              email: email,
              phone: phone,
              privacyAgreed: formData.privacyAgreed,
            });
          }
        }
      } catch (error) {
        console.error('[AuthInformation] Error checking existing patient:', error);
      }
    };

    checkExistingPatient();
  }, [enrollmentModule, storageKey]);

  const handleFieldChange = (field: string, fieldValue: any) => {
    const newData = { ...formData, [field]: fieldValue };
    onChange?.(newData);
  };

  // Handle phone number input with masking
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract only digits from the input
    const rawPhone = e.target.value.replace(/\D/g, '');
    // Limit to 10 digits
    const limitedPhone = rawPhone.slice(0, 10);
    // Store the raw digits, not the formatted version
    handleFieldChange("phone", limitedPhone);
  };

  // Handle email blur with patient update
  const handleEmailBlur = async () => {
    setTouchedFields((prev) => ({ ...prev, email: true }));

    // Update patient profile if enrollment module is available and email is valid
    if (enrollmentModule && formData.email && validateEmail(formData.email)) {
      try {
        await enrollmentModule.updatePatientField('email', formData.email, storageKey);
      } catch (error) {
        console.error('[AuthInformation] Error updating patient email:', error);
      }
    }
  };

  // Handle phone blur with patient update
  const handlePhoneBlur = async () => {
    setTouchedFields((prev) => ({ ...prev, phone: true }));

    // Update patient profile if enrollment module is available and phone is valid
    // formData.phone is already in raw format (digits only)
    if (enrollmentModule && formData.phone && formData.phone.length === 10) {
      try {
        await enrollmentModule.updatePatientField('phone', formData.phone, storageKey);
      } catch (error) {
        console.error('[AuthInformation] Error updating patient phone:', error);
      }
    }
  };

  // Handle email change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange("email", e.target.value);
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneChange(e);
  };

  return (
    <div
      className="w-full min-w-0 max-w-xl mx-auto flex flex-col items-center justify-center"
      ref={ref}
    >
      <div className="max-w-sm mb-6 sm:mb-8 flex flex-col items-center justify-center gap-2">
        <h2 className={themeConfig.title}>
          {block.title || "How can you be reached if necessary?"}
        </h2>

        <p className={cn(themeConfig.description)}>
          {block.description || "Our medical teams and pharmacy use email and text for patient communication."}
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:gap-8 max-w-xl w-full">
        {/* Email Field */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`${block.fieldName}-email`}
            className={cn(themeConfig.field.label)}
          >
            {block.emailLabel || "Email"}
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-6 top-1/2 transform -translate-y-1/2 w-6 h-6 stroke-[1.5px]"
              style={{ color: themeConfig.colors.text }}
            />
            <Input
              id={`${block.fieldName}-email`}
              type="email"
              name={`${block.fieldName}-email`}
              value={formData.email || ""}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              disabled={disabled}
              className={cn(
                themeConfig.field.input,
                "w-full",
                error?.email && touchedFields.email && "border-destructive"
              )}
              style={{ paddingLeft: "4rem" }}
              aria-invalid={!!(error?.email && touchedFields.email)}
            />
          </div>
          {touchedFields.email && error?.email && (
            <div className={cn("font-medium", themeConfig.field.error)}>
              {error?.email}
            </div>
          )}
        </div>

        {/* Phone Field */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`${block.fieldName}-phone`}
            className={cn(themeConfig.field.label)}
          >
            {block.phoneLabel || "Phone Number"}
          </Label>
          <div className="relative">
            <Phone
              className="absolute left-6 top-1/2 transform -translate-y-1/2 w-6 h-6 stroke-[1.5px]"
              style={{ color: themeConfig.colors.text }}
            />
            <Input
              id={`${block.fieldName}-phone`}
              type="tel"
              name={`${block.fieldName}-phone`}
              value={formatPhoneNumber(formData.phone || "")}
              onChange={handlePhoneInputChange}
              onBlur={handlePhoneBlur}
              disabled={disabled}
              className={cn(
                themeConfig.field.input,
                "w-full",
                error?.phone && touchedFields.phone && "border-destructive"
              )}
              style={{ paddingLeft: "4rem" }}
              aria-invalid={!!(error?.phone && touchedFields.phone)}
            />
          </div>
          {touchedFields.phone && error?.phone && (
            <div className={cn("font-medium", themeConfig.field.error)}>
              {error?.phone}
            </div>
          )}
        </div>

        {/* Privacy Agreement Checkbox */}
        <div className="flex items-start pt-2 gap-4">
          <Cbox
            id={`${block.fieldName}-privacy`}
            checked={formData.privacyAgreed || false}
            onCheckedChange={(checked) => {
              handleFieldChange("privacyAgreed", checked);
              setTouchedFields((prev) => ({
                ...prev,
                privacyAgreed: checked ? true : false,
              }));
            }}
            disabled={disabled}
            className="rounded-md"
            themeConfig={themeConfig}
          />
          <Label
            htmlFor={`${block.fieldName}-privacy`}
            className={cn(
              themeConfig.field.label,
              "cursor-pointer flex-1 mb-0"
            )}
          >
            {merchantName
              ? (block.privacyText || "I understand that my information is never shared, is protected by HIPAA and agree to the terms and privacy policies and to be contacted as necessary by our platform and its medical partners and can opt-out at anytime.").replace(/our platform/g, merchantName)
              : (block.privacyText || "I understand that my information is never shared, is protected by HIPAA and agree to the terms and privacy policies and to be contacted as necessary by our platform and its medical partners and can opt-out at anytime.")
            }
          </Label>
        </div>
        {touchedFields.privacyAgreed && error?.privacyAgreed && (
          <div className={cn("font-medium", themeConfig.field.error)}>
            {error?.privacyAgreed}
          </div>
        )}
      </div>
    </div>
  );
});

AuthInformationRenderer.displayName = "AuthInformationRenderer";

// Saved as { email, phone, privacyAgreed }, the phone as its digits
const AuthInformationAnswerView = ({ value }: AnswerViewProps) => (
  <AnswerFields
    fields={[
      { label: "Email", value: textOf(value?.email) },
      { label: "Phone", value: phoneText(value?.phone) },
      {
        label: "Privacy terms",
        value: typeof value?.privacyAgreed === "boolean" ? (value.privacyAgreed ? "Agreed" : "Not agreed") : undefined,
      },
    ]}
  />
);

// Export the Block Definition
export const AuthInformationBlock: BlockDefinition = {
  type: "AuthInformation",
  name: "Auth Information",
  description:
    "An auth information form with email, phone, and privacy agreement.",
  icon: <Mail className="w-6 h-6" />,
  defaultData: {
    type: "AuthInformation",
    fieldName: "AuthInformation",
    required: true,
    // Configurable text fields
    title: "How can you be reached if necessary?",
    description: "Our medical teams and pharmacy use email and text for patient communication.",
    emailLabel: "Email",
    phoneLabel: "Phone Number",
    privacyText: "I understand that my information is never shared, is protected by HIPAA and agree to the terms and privacy policies and to be contacted as necessary by our platform and its medical partners and can opt-out at anytime.", // Note: our platform will be replaced with merchant.business.name
    // Validation error messages
    emailRequiredError: "Email is required",
    emailInvalidError: "Please enter a valid email address",
    phoneRequiredError: "Phone number is required",
    phoneInvalidError: "Please enter a valid 10-digit phone number",
    privacyRequiredError: "You must agree to continue",
  },
  renderItem: (props) => <AuthInformationItem {...props} />,
  renderFormFields: (props) => <AuthInformationForm {...props} />,
  renderPreview: () => <AuthInformationPreview />,
  renderBlock: (props: BlockRendererProps) => (
    <AuthInformationRenderer
      {...(props as AuthInformationRendererProps)}
    />
  ),
  validate: (data: BlockData) => {
    if (!data.fieldName) return "Field name is required";
    return null;
  },
  validateValue: (value: any, blockData: BlockData) => {
    const errors = {} as any;

    if (!value) {
      return {
        email: blockData.emailRequiredError || "Email is required",
        phone: blockData.phoneRequiredError || "Phone number is required",
        privacyAgreed: blockData.privacyRequiredError || "You must agree to continue",
      };
    }

    const formData = value;

    if (!formData.email) {
      errors.email = blockData.emailRequiredError || "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = blockData.emailInvalidError || "Please enter a valid email address";
    }

    if (!formData.phone) {
      errors.phone = blockData.phoneRequiredError || "Phone number is required";
    } else if (!validatePhone(formData.phone)) {
      errors.phone = blockData.phoneInvalidError || "Please enter a valid 10-digit phone number";
    }

    if (!formData.privacyAgreed) {
      errors.privacyAgreed = blockData.privacyRequiredError || "You must agree to continue";
    }

    return Object.keys(errors).length ? errors : null;
  },
  answerView: (props) => <AuthInformationAnswerView {...props} />,
  outputSchema: {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "Patient's email address",
      },
      phone: {
        type: "string",
        description: "Patient's phone number",
      },
    },
  },
};