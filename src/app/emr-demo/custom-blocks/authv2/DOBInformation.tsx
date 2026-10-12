import React, { forwardRef, useEffect, useRef, useState } from "react"
import { Calendar } from "lucide-react"

import type {
  BlockDefinition,
  ContentBlockItemProps,
  BlockRendererProps,
  BlockData,
} from "@/packages/survey-form-package/src/types"

import { themes } from "@/packages/survey-form-package/src/themes"
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext"
import { Input } from "@/packages/survey-form-package/src/components/ui/input"
import { Label } from "@/packages/survey-form-package/src/components/ui/label"
import { Card } from "@/packages/survey-form-package/src/components/ui/card"
import { cn } from "@/packages/survey-form-package/src/lib/utils"

// ============================================================================
// BLOCK IMPLEMENTATION
// ============================================================================

// Builder Form Component (for customizing block properties)
const DOBInformationBlockForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handle = (field: string, value: any) =>
    onUpdate?.({ ...data, [field]: value })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fieldName">Field Name</Label>
        <Input
          id="fieldName"
          value={data.fieldName || ""}
          onChange={(e) => handle("fieldName", e.target.value)}
          placeholder="dob"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for storing responses
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="label">Input Label</Label>
        <Input
          id="label"
          value={data.label || ""}
          onChange={(e) => handle("label", e.target.value)}
          placeholder="Date of birth"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="placeholder">Input Placeholder</Label>
        <Input
          id="placeholder"
          value={data.placeholder || ""}
          onChange={(e) => handle("placeholder", e.target.value)}
          placeholder="MM-DD-YYYY"
        />
      </div>
    </div>
  )
}

// Builder Item Preview (shown in the builder canvas)
const DOBInformationBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  return (
    <Card className="space-y-3 p-4 text-center">
      <h2 className="text-md font-semibold">Medication can be tailored...</h2>
      <h3 className="text-lg">What is your date of birth?</h3>
      <div className="text-left pt-4">
        <Label>{data.label || "Date of birth"}</Label>
        <Input
          disabled
          placeholder={data.placeholder || "MM-DD-YYYY"}
          className="mt-1"
        />
      </div>
    </Card>
  )
}

// Builder Palette Preview (shown in the blocks palette)
const DOBInformationBlockPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        Date of Birth
      </div>
    </div>
  )
}

// Track which blocks have auto-skipped in this page session (clears on page reload)
const autoSkippedBlocks = new Set<string>();

// Renderer Component (shown to end users filling the form)
const DOBInformationRenderer = forwardRef<HTMLInputElement, BlockRendererProps>(
  ({ block, value, onChange, onBlur, error, disabled, theme }, ref) => {
    const { customData, goToNextBlock, setValue } = useSurveyForm()
    const themeConfig = theme ?? themes.default
    const hasCheckedPatient = useRef(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Get enrollment module from customData
    const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule)

    // Use enrollment module's default storage key
    const storageKey = enrollmentModule?.getPatientAuthStorageKey()

    // Check for existing patient data on mount
    useEffect(() => {
      if (!enrollmentModule || hasCheckedPatient.current) return

      hasCheckedPatient.current = true

      const checkExistingPatient = async () => {
        try {
          // Check if auto-skip has already happened for this block in this session
          const autoSkipKey = `${block.fieldName}_${storageKey}`;
          if (autoSkippedBlocks.has(autoSkipKey)) {
            // Auto-skip already happened, don't do it again
            return;
          }


          const stored = enrollmentModule.getStoredPatientAuth(storageKey)

          if (stored?.patient?.dateOfBirth) {
            // Patient already has DOBInformation, auto-skip
            const formattedDob = stored.patient.dateOfBirth
            setValue(block.fieldName as any, formattedDob)

            // Mark that auto-skip has happened for this block
            autoSkippedBlocks.add(autoSkipKey);

            // Skip to next block
            setTimeout(() => {
              goToNextBlock({ [block.fieldName as any]: formattedDob })
            }, 50)
          }
        } catch (error) {
          console.error('[DobBlock] Error checking existing patient:', error)
        }
      }

      checkExistingPatient()
    }, [enrollmentModule, storageKey, block.fieldName])

    // Handle blur with patient update
    const handleBlurWithUpdate = async (e: React.FocusEvent<HTMLInputElement>) => {
      if (onBlur) onBlur()

      // If we have a valid complete date and enrollment module, update patient
      if (enrollmentModule && value && value.length === 10 && !isUpdating) {
        setIsUpdating(true)
        try {
          await enrollmentModule.updatePatientField('dateOfBirth', value, storageKey)
        } catch (error) {
          console.error('[DobBlock] Error updating patient dateOfBirth:', error)
        } finally {
          setIsUpdating(false)
        }
      }
    }

    const formatDateInput = (input: string): string => {
      // Remove all non-digit characters
      const digitsOnly = input.replace(/\D/g, "")
      let formatted = digitsOnly

      if (digitsOnly.length > 4) {
        formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(
          2,
          4
        )}-${digitsOnly.slice(4, 8)}`
      } else if (digitsOnly.length > 2) {
        formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 4)}`
      } else {
        formatted = digitsOnly
      }
      return formatted
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const currentFormattedValue = value || ""

      // If user is deleting, allow it more freely
      if (inputValue.length < currentFormattedValue.length) {
        // If deleting a '-', remove it and the preceding number
        if (
          currentFormattedValue.endsWith("-") &&
          inputValue.length === currentFormattedValue.length - 1
        ) {
          onChange?.(inputValue.slice(0, -1))
          return
        }
        onChange?.(inputValue)
        return
      }

      // Format the input
      const formatted = formatDateInput(inputValue)

      if (formatted.length <= 10) {
        onChange?.(formatted)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow backspace, delete, tab, escape, enter, and arrow keys
      if (
        [8, 9, 27, 13, 46, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
        (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+A (Cmd+A)
        (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+C (Cmd+C)
        (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+V (Cmd+V)
        (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) // Ctrl+X (Cmd+X)
      ) {
        return
      }

      // Ensure that it's a number and stop the keypress if it's not
      if (
        (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
        (e.keyCode < 96 || e.keyCode > 105)
      ) {
        e.preventDefault()
      }
    }

    return (
      <div className="w-full min-w-0 max-w-2xl mx-auto">
        <h2 className={cn("mb-6 sm:mb-10", themeConfig.title)}>
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

        <h3 className={cn("mb-2", themeConfig.title)}>
          What is your date of birth?
        </h3>

        <p className={cn("mb-4 sm:mb-8", themeConfig.description)}>
          This helps us understand your body complexity and hormones so we can
          assess you better.
        </p>

        <div className="max-w-sm mx-auto">
          <Label
            htmlFor={block.fieldName}
            className={cn(themeConfig.field.label, "mb-2")}
          >
            {block.label}
          </Label>
          <Input
            id={block.fieldName}
            ref={ref}
            type="text" // Use text to allow for '-' characters
            inputMode="numeric" // Show number pad on mobile
            name={block.fieldName}
            placeholder={block.placeholder}
            value={value || ""}
            onChange={handleChange} // Use custom handler
            onKeyDown={handleKeyDown} // Use custom keydown handler
            onBlur={handleBlurWithUpdate}
            disabled={disabled || isUpdating}
            maxLength={10} // MM-DD-YYYY
            className={cn(
              "transition-colors",
              error && "border-destructive",
              themeConfig.field.input
            )}
            aria-invalid={!!error}
          />
          {error && (
            <div
              className={cn(
                "text-sm font-medium mt-2",
                themeConfig.field.error
              )}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }
)

DOBInformationRenderer.displayName = "DOBInformationRenderer"

// Export the Block Definition
export const DOBInformationBlock: BlockDefinition = {
  type: "dobInformation",
  name: "Date of Birth",
  description: "A styled date of birth input field with masking.",
  icon: <Calendar className="w-4 h-4" />,
  defaultData: {
    type: "dobInformation",
    fieldName: "dob",
    label: "Date of birth",
    placeholder: "MM-DD-YYYY",
    required: true,
  },
  renderItem: (props) => <DOBInformationBlockItem {...props} />,
  renderFormFields: (props) => <DOBInformationBlockForm {...props} />,
  renderPreview: () => <DOBInformationBlockPreview />,
  renderBlock: (props) => <DOBInformationRenderer {...props} />,
  validate: (data: BlockData) => {
    if (!data.fieldName) return "Field name is required"
    return null
  },
  validateValue: (value: any, data: BlockData) => {
    if (data.required && !value) return `Required field.`
    if (value && value.length !== 10) {
      return `Please enter a complete date (MM-DD-YYYY).`
    }
    // Basic date validation
    if (value) {
      const parts = value.split("-")
      if (parts.length !== 3) return "Invalid date format."
      const month = parseInt(parts[0], 10)
      const day = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)
      if (month < 1 || month > 12) return "Month must be between 01 and 12."
      if (day < 1 || day > 31) return "Day must be between 01 and 31."
      if (year < 1900 || year > new Date().getFullYear())
        return "Please enter a valid year."
    }
    return null
  },
}