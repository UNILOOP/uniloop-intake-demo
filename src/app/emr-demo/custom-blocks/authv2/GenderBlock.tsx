import { Mars, Venus, ToggleLeft } from "lucide-react";

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type {
  BlockDefinition,
  ContentBlockItemProps,
  BlockData,
} from "@/packages/survey-form-package/src/types";

import { themes } from "@/packages/survey-form-package/src/themes";
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext";
import { Input } from "@/packages/survey-form-package/src/components/ui/input";
import { Label } from "@/packages/survey-form-package/src/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/packages/survey-form-package/src/components/ui/radio-group";
import { cn } from "@/packages/survey-form-package/src/lib/utils";
import { Card } from "@/packages/survey-form-package/src/components/ui/card";

const Female = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#clip0_672_1745)">
        <path
          d="M60.6266 71.785H53.6975V60.4518C67.5527 57.7774 77.9009 45.3213 77.9009 30.9788C77.9058 14.3315 64.4897 0.787109 48.0018 0.787109C31.5139 0.787109 18.0977 14.3315 18.0977 30.9788C18.0977 45.3213 28.45 57.7725 42.3011 60.4518V71.785H35.3757C32.2343 71.785 29.6792 74.361 29.6792 77.5279C29.6792 80.6949 32.2343 83.2708 35.3757 83.2708H42.3049V90.2524C42.3049 93.4242 44.8601 96.0002 48.0014 96.0002C51.1428 96.0002 53.698 93.4242 53.698 90.2573V83.2757H60.6271C63.7685 83.2757 66.3237 80.6998 66.3237 77.5328C66.3237 74.361 63.768 71.785 60.6266 71.785ZM60.6266 80.9757H52.5581C51.9278 80.9757 51.4198 81.4879 51.4198 82.1233V90.2535C51.4198 92.1546 49.8856 93.7012 47.9998 93.7012C46.114 93.7012 44.5799 92.1546 44.5799 90.2535V82.1283C44.5799 81.4929 44.0718 80.9807 43.4416 80.9807L35.3731 80.9758C33.4873 80.9758 31.9532 79.4292 31.9532 77.528C31.9532 75.6269 33.4873 74.0803 35.3731 74.0803H43.4416C44.0718 74.0803 44.5799 73.568 44.5799 72.9327V59.5611C44.5799 59.433 44.4822 59.3444 44.4431 59.2262C44.3943 59.0833 44.3796 58.9454 44.2819 58.8321C44.1842 58.7139 44.0523 58.6745 43.9155 58.6056C43.808 58.5514 43.7396 58.4381 43.6126 58.4184C30.3627 56.3351 20.3722 44.5336 20.3722 30.9691C20.3722 15.5876 32.7668 3.07218 47.995 3.07218C63.2285 3.07218 75.6179 15.5874 75.6179 30.9691C75.6179 44.5336 65.627 56.3291 52.3775 58.4184C52.2505 58.4381 52.1821 58.5465 52.0746 58.6056C51.9378 58.6745 51.8059 58.7139 51.7082 58.8321C51.6104 58.9454 51.5958 59.0833 51.5469 59.2262C51.5078 59.3444 51.4101 59.4281 51.4101 59.5611V72.9327C51.4101 73.568 51.9182 74.0803 52.5485 74.0803H60.617C62.5028 74.0803 64.0369 75.6269 64.0369 77.528C64.0467 79.4341 62.5124 80.9757 60.6266 80.9757ZM68.803 30.9592C68.803 19.3945 59.4717 9.98698 48.0002 9.98698C36.5287 9.98698 27.1973 19.3943 27.1973 30.9592C27.1973 42.5238 36.5287 51.9313 48.0002 51.9313C59.4717 51.9313 68.803 42.5191 68.803 30.9592ZM48.0002 49.6315C37.7845 49.6315 29.4749 41.2536 29.4749 30.9592C29.4749 20.6603 37.7851 12.283 48.0002 12.283C58.2152 12.283 66.5255 20.6609 66.5255 30.9592C66.5255 41.2531 58.2152 49.6315 48.0002 49.6315Z"
          fill="url(#paint0_linear_672_1745)"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_672_1745"
          x1="9.86204"
          y1="32.8554"
          x2="79.8971"
          y2="42.6411"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--survey-secondary)" />
          <stop offset="1" stopColor="var(--survey-primary)" />
        </linearGradient>
        <clipPath id="clip0_672_1745">
          <rect width="96" height="96" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};

const Male = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M24.749 36.8348C20.0157 40.7472 17.1032 46.2451 16.5494 52.327C15.9956 58.4046 17.8642 64.3328 21.8166 69.0176C26.3786 74.4288 32.9444 77.2172 39.5588 77.2172C44.7742 77.2172 50.0216 75.4818 54.3279 71.9243C64.1011 63.851 65.4159 49.416 57.2642 39.7415C49.1045 30.0669 34.5182 28.7655 24.749 36.8348ZM52.7745 70.0828C44.0291 77.3122 30.9728 76.1447 23.6739 67.4837C20.1359 63.2913 18.4625 57.9827 18.9606 52.5438C19.4586 47.1012 22.0643 42.1787 26.2995 38.6812C30.1562 35.4946 34.8496 33.9406 39.5192 33.9406C45.4398 33.9406 51.3202 36.4372 55.4 41.2803C62.6991 49.9412 61.5198 62.8617 52.7745 70.0828ZM88.672 17.1313C88.6601 15.1987 87.2616 13.5383 85.3412 13.1794L66.7106 9.70478C64.9775 9.37349 63.2283 9.83493 61.8817 10.9472C60.1286 12.3985 59.3916 14.6585 59.9693 16.8474C60.543 19.0403 62.3001 20.6612 64.5472 21.0793L69.5951 22.0219L60.2044 29.7797C48.3391 20.0026 30.7366 19.9355 18.8 29.7994C12.1822 35.2619 8.11083 42.9684 7.33362 51.503C6.55669 60.0338 9.16639 68.3441 14.6885 74.8907C20.2186 81.4496 28.0112 85.4881 36.634 86.2655C37.634 86.3562 38.634 86.3996 39.6261 86.3996C47.1802 86.3996 54.4156 83.8202 60.264 78.9889C72.2088 69.1251 75.2922 51.9685 67.6986 38.6693L77.0616 30.9311L77.0974 35.9755C77.1134 38.2354 78.4123 40.235 80.484 41.1855C81.2809 41.5523 82.1255 41.7337 82.9582 41.7337C84.2969 41.7337 85.6118 41.2723 86.6955 40.377C88.0421 39.2647 88.8071 37.6319 88.7991 35.8966L88.672 17.1313ZM85.134 38.535C84.0901 39.3948 82.7275 39.5762 81.4964 39.0083C80.2613 38.4443 79.5202 37.3006 79.5122 35.9557L79.4604 28.3715C79.4604 28.3163 79.4365 28.265 79.4286 28.2098C79.4166 28.1269 79.4087 28.052 79.3768 27.9731C79.3449 27.8903 79.3011 27.8233 79.2572 27.7523C79.2294 27.7089 79.2174 27.6576 79.1815 27.6142C79.1696 27.5984 79.1497 27.5945 79.1377 27.5787C79.0819 27.5156 79.0102 27.4722 78.9425 27.421C78.8827 27.3776 78.823 27.3303 78.7552 27.2987C78.6955 27.2711 78.6277 27.2632 78.564 27.2435C78.4763 27.2198 78.3887 27.1922 78.2971 27.1883C78.2811 27.1883 78.2652 27.1804 78.2492 27.1804H78.2413C78.1895 27.1804 78.1456 27.2041 78.0978 27.2119C78.0062 27.2238 77.9186 27.2356 77.8349 27.2672C77.7592 27.2948 77.6915 27.3382 77.6237 27.3815C77.5759 27.4131 77.5201 27.4249 77.4763 27.4604L65.3765 37.4583C65.3406 37.4899 65.3207 37.5333 65.2888 37.5648C65.2291 37.6279 65.1693 37.691 65.1255 37.766C65.0856 37.8291 65.0617 37.8922 65.0339 37.9592C65.006 38.0342 64.9821 38.1052 64.9661 38.188C64.9542 38.2629 64.9542 38.3339 64.9542 38.4088C64.9542 38.4877 64.9621 38.5587 64.9781 38.6376C64.994 38.7165 65.0299 38.7914 65.0617 38.8663C65.0817 38.9097 65.0856 38.9571 65.1096 39.0004C72.7593 51.4122 70.0022 67.811 58.6989 77.1463C52.5791 82.2025 44.806 84.5965 36.837 83.8787C28.8566 83.1648 21.6488 79.4259 16.5337 73.3601C11.4259 67.3022 9.01144 59.6197 9.73256 51.7272C10.4497 43.8313 14.2188 36.7004 20.3381 31.6481C31.6373 22.3127 48.4309 22.5651 59.3996 32.2358C59.4235 32.2555 59.4554 32.2436 59.4793 32.2634C59.6944 32.429 59.9415 32.5395 60.2044 32.5395C60.2164 32.5395 60.2283 32.5276 60.2403 32.5276C60.32 32.5237 60.3757 32.4685 60.4554 32.4527C60.6387 32.4132 60.826 32.3935 60.9774 32.2634L73.1017 22.2496C73.1455 22.2101 73.1694 22.1589 73.2092 22.1155C73.265 22.0563 73.3168 22.0011 73.3566 21.9301C73.4005 21.8552 73.4284 21.7763 73.4562 21.6935C73.4722 21.6422 73.5041 21.6028 73.516 21.5476C73.52 21.5278 73.512 21.5081 73.516 21.4884C73.528 21.4056 73.52 21.3228 73.512 21.2399C73.508 21.165 73.508 21.094 73.4881 21.023C73.4682 20.952 73.4323 20.8889 73.4005 20.8219C73.3646 20.7469 73.3327 20.672 73.2849 20.605C73.273 20.5892 73.269 20.5695 73.257 20.5537C73.2172 20.5064 73.1654 20.4827 73.1216 20.4472C73.0618 20.3959 73.01 20.3407 72.9383 20.3013C72.8546 20.2539 72.767 20.2224 72.6753 20.1948C72.6315 20.183 72.5957 20.1514 72.5478 20.1435L64.9818 18.7277C63.6431 18.4792 62.643 17.5484 62.3004 16.2469C61.9577 14.9454 62.3761 13.6518 63.42 12.792C64.2129 12.1412 65.2488 11.8809 66.2527 12.0624L84.8834 15.537C85.6643 15.6829 86.234 16.3613 86.238 17.1462L86.3575 35.9117C86.3774 36.9253 85.9228 37.8842 85.134 38.535Z"
        fill="url(#paint0_linear_672_1737)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_672_1737"
          x1="-4.03807"
          y1="35.4663"
          x2="88.2337"
          y2="57.2758"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--survey-secondary)" />
          <stop offset="1" stopColor="var(--survey-primary)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ============================================================================
// ORIGINAL BLOCK CODE (NOW USING MOCKS)
// ============================================================================

const options = [
  {
    value: "male",
    label: "Male",
    icon: Male,
  },
  {
    value: "female",
    label: "Female",
    icon: Female,
  },
];

// Track which blocks have auto-skipped in this page session (clears on page reload)
const autoSkippedBlocks = new Set<string>();

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Memoized SelectionCard component to prevent unnecessary re-renders
const SelectionCard = React.memo(
  ({
    optionValue,
    label,
    icon,
    isSelected,
    themeConfig,
    block,
    onBlur,
    disabled,
  }: {
    optionValue: string;
    label: string;
    icon: React.ComponentType<{
      className: string;
      style?: React.CSSProperties;
    }>;
    isSelected: boolean;
    themeConfig: any;
    block: any;
    onBlur?: () => void;
    disabled?: boolean;
  }) => {
    const Icon = icon;
    return (
      <Label
        htmlFor={`${block.fieldName}-${optionValue}`}
        className={cn(
          "relative",
          icon
            ? "flex flex-col items-center justify-center gap-6 md:gap-10"
            : "flex justify-between gap-6 items-center",
          themeConfig.field.input,
          "w-full md:h-[240px] h-[164px] md:w-[200px]"
        )}
      >
        <RadioGroupItem
          value={optionValue}
          id={`${block.fieldName}-${optionValue}`}
          className="sr-only"
          disabled={disabled}
          onBlur={onBlur}
        />

        {Icon && (
          <div className="relative w-16 h-16 md:w-24 md:h-24">
            <Icon className="w-full h-full" />
          </div>
        )}
        <p
          className={cn(
            themeConfig.field.label,
            icon ? "w-fit" : "max-w-2/3",
            "text-center"
          )}
          style={{ color: isSelected ? themeConfig.colors.primary : "" }}
        >
          {label}
        </p>

        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border bg-white",
            icon ? "absolute right-4 top-6" : "relative"
          )}
          style={{
            borderColor: isSelected
              ? themeConfig.colors.primary
              : themeConfig.colors.border,
          }}
        >
          {isSelected && (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: themeConfig.colors.primary }}
            />
          )}
        </div>
      </Label>
    );
  }
);

SelectionCard.displayName = "SelectionCard";

// Builder Form Component (for customizing block properties)
const GenderInformationBlockForm: React.FC<ContentBlockItemProps> = ({
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
          placeholder="gender"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for storing responses
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={data.label || ""}
          onChange={(e) => handle("label", e.target.value)}
          placeholder="Are you male or female?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description/Help Text</Label>
        <Input
          id="description"
          value={data.description || ""}
          onChange={(e) => handle("description", e.target.value)}
          placeholder="This helps us understand your body..."
        />
      </div>
    </div>
  );
};

// Builder Item Preview (shown in the builder canvas)
const GenderInformationBlockItem: React.FC<ContentBlockItemProps> = ({
  data,
}) => {
  return (
    <Card className="space-y-3 p-4">
      <p className="text-center text-muted-foreground text-sm">
        Medication can be tailored to your unique needs...
      </p>
      {data.label && (
        <Label className="text-center block text-lg font-semibold">
          {data.label}
        </Label>
      )}
      {data.description && (
        <p className="text-sm text-muted-foreground text-center">
          {data.description}
        </p>
      )}
      <div className="flex gap-4 pt-2">
        <div className="flex-1 p-4 flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30">
          <Mars className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Male</p>
        </div>
        <div
          className="flex-1 p-4 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-primary"
          style={{ borderColor: themes.default.colors.primary }}
        >
          <Venus
            className="w-10 h-10 text-primary"
            style={{ color: themes.default.colors.primary }}
          />
          <p
            className="text-sm font-medium text-primary"
            style={{ color: themes.default.colors.primary }}
          >
            Female
          </p>
        </div>
      </div>
    </Card>
  );
};

// Builder Palette Preview (shown in the blocks palette)
const GenderInformationBlockPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        Gender Selection
      </div>
    </div>
  );
};

// Renderer Component (shown to end users filling the form)
const GenderInformationRenderer = forwardRef<HTMLDivElement, any>(
  ({ block, value, onChange, onBlur, error, disabled, theme }, ref) => {
    const { customData, goToNextBlock, setValue } = useSurveyForm();
    const themeConfig = theme || themes.default;
    const hasCheckedPatient = useRef(false);
    const [isUpdating, setIsUpdating] = useState(false);

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
          // Check if auto-skip has already happened for this block in this page session
          const autoSkipKey = `${block.fieldName}_${storageKey}`;
          if (autoSkippedBlocks.has(autoSkipKey)) {
            // Auto-skip already happened, don't do it again
            return;
          }

          const stored = enrollmentModule.getStoredPatientAuth(storageKey);

          if (stored?.patient?.gender) {
            // Patient already has gender, auto-skip
            const patientGender = stored.patient.gender == "M" ? "male" : "female";
            setValue(block.fieldName, patientGender);

            // Mark that auto-skip has happened for this block
            autoSkippedBlocks.add(autoSkipKey);

            // Skip to next block
            setTimeout(() => {
              goToNextBlock({ [block.fieldName]: patientGender });
            }, 50);
          }
        } catch (error) {
          console.error('[GenderBlock] Error checking existing patient:', error);
        }
      };

      checkExistingPatient();
    }, [enrollmentModule, storageKey, block.fieldName]);

    const handleValueChange = useCallback(
      async (val: string) => {
        onChange?.(val);
        setValue(block.fieldName, val);

        // Update patient profile if enrollment module is available
        if (enrollmentModule && !isUpdating) {
          setIsUpdating(true);
          try {
            // This will update both gender and genderBiological to the same value
            await enrollmentModule.updatePatientField('gender', val, storageKey);
            await enrollmentModule.updatePatientField('genderBiological', val, storageKey);
          } catch (error) {
            console.error('[GenderBlock] Error updating patient gender:', error);
          } finally {
            setIsUpdating(false);
          }
        }
      },
      [onChange, setValue, enrollmentModule, storageKey, isUpdating, block.fieldName]
    );

    return (
      <div className="w-full max-w-lg mx-auto">
        <h2 className={cn("mb-6 md:mb-10 text-center", themeConfig.title)}>
          Medication can be tailored to{" "}
          <span
            style={{
              background: `linear-gradient(to right, ${themeConfig.colors.secondary}, ${themeConfig.colors.primary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            your unique needs
          </span>
          , so let’s get to know you a little better.
        </h2>

        <h3 className={cn("mb-2 text-center", themeConfig.title)}>
          Are you male or female?
        </h3>

        <p className={cn("mb-4 md:mb-8", themeConfig.description)}>
          This helps us understand your body complexity and hormones so we can
          assess you better.
        </p>

        <RadioGroup
          ref={ref}
          value={value || ""}
          onValueChange={handleValueChange}
          disabled={disabled || isUpdating}
          className="w-full md:w-fit mx-auto grid grid-cols-2 gap-4"
          name={block.fieldName}
        >
          {options.map((option: any) => {
            return (
              <SelectionCard
                key={option.value}
                optionValue={option.value}
                label={option.label}
                icon={option.icon}
                isSelected={value === option.value}
                themeConfig={themeConfig}
                block={block}
                onBlur={onBlur}
                disabled={disabled}
              />
            );
          })}
        </RadioGroup>

        {error && (
          <div
            className={cn("text-sm font-medium mt-2", themeConfig.field.error)}
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);

GenderInformationRenderer.displayName = "GenderInformationRenderer";

// Export the Block Definition
export const GenderInformationBlock: BlockDefinition = {
  type: "genderInformation",
  name: "Gender Selection",
  description: "A card-based selection for gender.",
  icon: <ToggleLeft className="w-4 h-4" />,
  defaultData: {
    type: "genderInformation",
    fieldName: "gender",
    required: true,
  },
  renderItem: (props) => <GenderInformationBlockItem {...props} />,
  renderFormFields: (props) => <GenderInformationBlockForm {...props} />,
  renderPreview: () => <GenderInformationBlockPreview />,
  renderBlock: (props) => <GenderInformationRenderer {...props} />,
  validate: (data: BlockData) => {
    if (!data.fieldName) return "Field name is required";
    return null;
  },
  validateValue: (value: any, data: BlockData) => {
    if (data.required && !value) return `Please select an option.`;
    return null;
  },
  outputSchema: {
    type: "string",
  },
};