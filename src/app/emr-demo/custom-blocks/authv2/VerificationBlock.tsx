import React, { forwardRef, useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Heart,
} from "lucide-react";
import type {
  AnswerViewProps,
  BlockDefinition,
  ContentBlockItemProps,
  BlockRendererProps,
  BlockData,
  ThemeDefinition,
} from "@/packages/survey-form-package/src/types";
import { Badge } from "@/packages/survey-form-package/src/components/ui/badge";
import { Button } from "@/packages/survey-form-package/src/components/ui/button";
import { themes } from "@/packages/survey-form-package/src/themes";
import { useSurveyForm } from "@/packages/survey-form-package/src/context/SurveyFormContext";
import { useSurveyBuilder } from "@/packages/survey-form-package/src/context/SurveyBuilderContext";
import { Input } from "@/packages/survey-form-package/src/components/ui/input";
import { Label } from "@/packages/survey-form-package/src/components/ui/label";
import { Card } from "@/packages/survey-form-package/src/components/ui/card";
import { cn } from "@/packages/survey-form-package/src/lib/utils";
// @ts-ignore
import type { PatientAuthConfig, PatientAuthFormData } from "@/lib/enrollment-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/packages/survey-form-package/src/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import {
  Alert,
  AlertDescription,
} from "@/packages/survey-form-package/src/components/ui/alert";
import { useBlockOperation } from "@/packages/survey-form-package/src/hooks/useBlockOperation";
import { timeText } from "../AnswerFields";

// ============================================================================
// REUSABLE ERROR COMPONENTS
// ============================================================================

const ErrorMessage: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4"
      >
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
};

// Already Logged In Component
const AlreadyLoggedIn: React.FC<{
  patient: any;
  themeConfig: ThemeDefinition;
  onContinue: () => void;
  loading?: boolean;
}> = ({ patient, themeConfig, onContinue, loading }) => {
  const getDisplayName = () => {
    const firstName = patient?.firstName || patient?.first_name || "";
    const lastName = patient?.lastName || patient?.last_name || "";
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    return firstName || lastName || patient?.email || "there";
  };

  return (
    <div
      className="w-full min-w-0 max-w-xl mx-auto flex flex-col gap-6 sm:gap-8 items-center justify-center"
    >
      <div className="max-w-md flex flex-col items-center justify-center gap-4 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
        >
          <Shield className="w-10 h-10 text-green-600 dark:text-green-400" />
        </motion.div>

        <div className="space-y-2">
          <h2 className={cn(themeConfig.title, "text-2xl sm:text-3xl")}>
            Welcome back, {getDisplayName()}!
          </h2>
          <p className={cn(themeConfig.description, "text-base")}>
            You're already securely logged in. Click continue to proceed with your
            form.
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className={cn(
            "mt-4 w-full max-w-xs justify-center rounded-full px-8 py-4 sm:px-10 sm:py-5 text-white font-semibold text-sm sm:text-base transition-all duration-200 flex items-center gap-2.5",
            loading
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-[#1C1C1C]/80 active:scale-[0.98] cursor-pointer"
          )}
          style={{
            backgroundColor: "#1C1C1C",
            boxShadow:
              "inset 0 5px 8.8px rgba(255, 255, 255, 0.25), inset 0 -8px 9.9px rgba(0, 0, 0, 0.25)",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              Continue
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
              >
                <path
                  fill="currentColor"
                  d="M16.175 13H5q-.425 0-.712-.288T4 12t.288-.712T5 11h11.175l-4.9-4.9q-.3-.3-.288-.7t.313-.7q.3-.275.7-.288t.7.288l6.6 6.6q.15.15.213.325t.062.375t-.062.375t-.213.325l-6.6 6.6q-.275.275-.687.275T11.3 19.3q-.3-.3-.3-.712t.3-.713z"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// BUILDER COMPONENTS
// ============================================================================

// Builder Form Component (for customizing block properties)
const VerificationInformationForm: React.FC<ContentBlockItemProps> = ({
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
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fieldName">Field Name</Label>
        <Input
          id="fieldName"
          value={data.fieldName || ""}
          onChange={(e) => handle("fieldName", e.target.value)}
          placeholder="verification"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for storing responses
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Auth Method</Label>
          <Select
            value={data.authMethod || "otp"}
            onValueChange={(v) => handle("authMethod", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="otp">OTP (One-Time Password)</SelectItem>
              <SelectItem value="password">Password</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose authentication method
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="authField">Authentication Field</Label>
          <Select
            value={data.authField || "email"}
            onValueChange={(val) => handle("authField", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Authentication Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Which field to use for verification
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailKey">Email Key</Label>
        <Select
          value={data.emailKey || "AuthInformation.email"}
          onValueChange={(val) => handle("emailKey", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Email Key" />
          </SelectTrigger>
          <SelectContent
            className="max-h-[300px] overflow-y-auto z-50"
            side="bottom"
            align="start"
            sideOffset={5}
          >
            {intakeFields.map((name) => (
              <SelectItem key={name} value={name} className="pl-2">
                <span className="text-sm">{name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Path to email value in survey context
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneKey">Phone Key</Label>
        <Select
          value={data.phoneKey || "AuthInformation.phone"}
          onValueChange={(val) => handle("phoneKey", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Phone Key" />
          </SelectTrigger>
          <SelectContent
            className="max-h-[300px] overflow-y-auto z-50"
            side="bottom"
            align="start"
            sideOffset={5}
          >
            {intakeFields.map((name) => (
              <SelectItem key={name} value={name} className="pl-2">
                <span className="text-sm">{name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Path to phone value in survey context
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="storageKeyIdentifier">Storage Key Identifier</Label>
        <Input
          id="storageKeyIdentifier"
          value={data.storageKeyIdentifier || ""}
          onChange={(e) => handle("storageKeyIdentifier", e.target.value)}
          placeholder="patient_auth"
        />
        <p className="text-xs text-muted-foreground">
          Optional identifier for auth storage key
        </p>
      </div>
    </div>
  );
};

// Builder Item Preview (shown in the builder canvas)
const VerificationInformationItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  const authMethod = data.authMethod || "otp";
  return (
    <Card className="space-y-3 p-4 text-center">
      <h2 className="text-lg font-bold">
        {authMethod === "password" ? "Enter Your Password" : "Verify Your Code"}
      </h2>
      <p className="text-sm text-gray-600">
        {authMethod === "password" ? (
          <>
            Enter your password to continue with your{" "}
            {data.authField === "phone" ? "phone" : "email"}
          </>
        ) : (
          <>
            Enter the 6-digit verification code sent to your{" "}
            {data.authField === "phone" ? "phone" : "email"}.
          </>
        )}
      </p>
      <div className="text-left space-y-4 pt-4">
        <div>
          <Label>
            {authMethod === "password" ? "Password" : "Verification Code"}
          </Label>
          <Input
            disabled
            type={authMethod === "password" ? "password" : "text"}
            placeholder={
              authMethod === "password" ? "Enter your password" : "000000"
            }
            className={authMethod === "otp" ? "text-center" : ""}
          />
        </div>
      </div>
    </Card>
  );
};

// Builder Palette Preview (shown in the blocks palette)
const VerificationInformationPreview: React.FC = () => {
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30">
        Verification
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to safely access nested object properties using dot notation
const getNestedValue = (obj: any, path: string | undefined | null): any => {
  if (!path || typeof path !== "string") return undefined;
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

// ============================================================================
// RENDERER COMPONENT
// ============================================================================

type VerificationRendererProps = BlockRendererProps;

// Track which blocks have auto-skipped in this page session (clears on page reload)
const autoSkippedBlocks = new Set<string>();

const VerificationInformationRenderer = forwardRef<
  HTMLDivElement,
  VerificationRendererProps
>(({ block, value, onChange, error, disabled, theme }, ref) => {
  const themeConfig = theme ?? themes.default;
  const { customData, values, goToNextBlock, errors, setValue } = useSurveyForm();
  const { runOperation } = useBlockOperation();
  const authMethod = block.authMethod || "otp";

  // OTP state
  const [otp, setOtp] = useState<string>(value?.otp || "");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Password state
  const [password, setPassword] = useState<string>(value?.password || "");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Common state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const [loggedInPatient, setLoggedInPatient] = useState<any>(null);

  // OTP resend state management
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const [resendCount, setResendCount] = useState<number>(0);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<
    string | null
  >(null);
  const RESEND_COOLDOWN_SECONDS = 30;
  const MAX_RESEND_ATTEMPTS = 3;
  const COOLDOWN_DURATION_MS = 10 * 60 * 1000;

  const countdownIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCheckedToken = useRef(false);

  const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule);
  const emailKey = block.emailKey || "AuthInformation.email";
  const phoneKey = block.phoneKey || "AuthInformation.phone";
  const authField = block.authField || "email";

  // Get email and phone from survey context
  const email = getNestedValue(values, emailKey) || "";
  const phone = getNestedValue(values, phoneKey) || "";

  // Build config from block data
  const config = useMemo<PatientAuthConfig>(() => {
    if (!enrollmentModule) {
      return {
        authMethod: authMethod,
        authField: authField,
        requireFirstName: false,
        requireLastName: false,
        requireMiddleName: false,
        requireGender: false,
        requireGenderBiological: false,
        requireDateOfBirth: false,
        requireHeight: false,
        requireWeight: false,
        collectAlternateContact: false,
        alternateContactRequired: false,
      };
    }

    const baseConfig = enrollmentModule.DEFAULT_PATIENT_AUTH_CONFIG;
    return {
      ...baseConfig,
      authMethod: authMethod,
      authField: authField,
    };
  }, [block, enrollmentModule, authMethod, authField]);

  const storageKey = useMemo(() => {
    if (!enrollmentModule) {
      return block.storageKeyIdentifier || "default_patient_auth";
    }
    return block.storageKeyIdentifier
      ? enrollmentModule.getPatientAuthStorageKey(block.storageKeyIdentifier)
      : enrollmentModule.DEFAULT_PATIENT_AUTH_STORAGE_KEY;
  }, [block.storageKeyIdentifier, enrollmentModule]);

  // Build form data for auth
  const formDataForAuth = useMemo<PatientAuthFormData>(
    () => ({
      email: email,
      phone: phone,
      otp: otp,
      password: password,
      firstName: "",
      lastName: "",
      middleName: "",
      gender: "",
      dateOfBirth: "",
      height: "",
      weight: "",
      genderBiological: "",
    }),
    [email, phone, otp, password]
  );

  // Countdown timer effect (OTP only)
  useEffect(() => {
    if (authMethod !== "otp") return;

    if (resendCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [resendCountdown, authMethod]);

  // Check cooldown status (OTP only)
  useEffect(() => {
    if (authMethod !== "otp" || !cooldownEndTime) return;

    const checkCooldown = setInterval(() => {
      const now = Date.now();
      if (now >= cooldownEndTime) {
        setCooldownEndTime(null);
        setResendCount(0);
      }
    }, 1000);

    return () => clearInterval(checkCooldown);
  }, [cooldownEndTime, authMethod]);

  // Initialize canGoNext to false on mount to ensure validation runs
  // This handles the case where state resume system restores old value with canGoNext: true
  useEffect(() => {
    const initialValue = { ...value, canGoNext: false };
    onChange?.(initialValue);
    if (block.fieldName) {
      setValue(block.fieldName, initialValue);
    }
  }, []); // Only run on mount

  // Check for existing auth on mount
  useEffect(() => {
    if (hasCheckedToken.current) return;
    hasCheckedToken.current = true;

    const checkExistingAuth = async () => {
      if (!enrollmentModule) return;

      const autoSkipKey = `${block.fieldName}_${storageKey}`;

      setLoading(true);
      try {
        const result = await enrollmentModule.validatePatientToken(
          config,
          storageKey
        );

        // Check if email/phone match
        const credentialsMatch = email === result.patient.email && phone === result.patient.phone;

        if (!credentialsMatch) {
          // Credentials don't match - clear stale vital reference
          enrollmentModule.clearVitalId();
          // Show OTP form for fresh auth
          if (
            authMethod === "otp" &&
            ((authField === "email" && email) || (authField === "phone" && phone))
          ) {
            await handleSendOtp({ isResend: false });
          }
          return;
        }

        // Credentials match - check if auth is valid
        if (result.success && result.patient && result.token) {
            // Valid auth with matching credentials - show "already logged in" message
            setIsAlreadyLoggedIn(true);
            setLoggedInPatient(result.patient);

            const authResults = enrollmentModule.buildPatientAuthResults(
              result.patient,
              result.token
            );
            const finalResult = {...authResults, "canGoNext": true}
            onChange?.(finalResult as any);

            // If already auto-skipped before (user navigated back), don't auto-skip again
            if (autoSkippedBlocks.has(autoSkipKey)) {
              return;
            }
        } else {
          // No valid auth - show OTP form
          if (
            authMethod === "otp" &&
            ((authField === "email" && email) || (authField === "phone" && phone))
          ) {
            await handleSendOtp({ isResend: false });
          }
        }
      } catch (e: any) {
          // Error checking auth - show OTP form
          if (
            authMethod === "otp" &&
            ((authField === "email" && email) || (authField === "phone" && phone))
          ) {
            await handleSendOtp({ isResend: false });
          }
      } finally {
        setLoading(false)
      }
    };

    checkExistingAuth();
  }, [config, storageKey, block.skipIfLoggedIn, onChange, enrollmentModule]);

  // OTP-specific handlers - uses useBlockOperation hook for deduplication across remounts
  const handleSendOtp = useCallback(async (options: { isResend?: boolean } = {}) => {
    const { isResend = false } = options;

    // For initial OTP send (not resend), use the operation guard to prevent duplicates
    if (!isResend) {
      const wasAllowed = await runOperation('send-otp', async (signal) => {
        await sendOtpInternal({ isResend: false, signal });
      });
      // If operation was debounced (duplicate), just return silently
      if (!wasAllowed) return;
    } else {
      // Resends bypass the deduplication guard
      await sendOtpInternal({ isResend: true });
    }
  }, [runOperation]);

  // Internal OTP send logic (extracted for use with runOperation)
  const sendOtpInternal = async (options: { isResend: boolean; signal?: AbortSignal }) => {
    const { isResend, signal } = options;

    if (!enrollmentModule) {
      setErrorMessage("Enrollment module not initialized");
      return;
    }

    // Check if aborted
    if (signal?.aborted) return;

    // Check if we're in cooldown
    if (cooldownEndTime && Date.now() < cooldownEndTime) {
      const remainingMinutes = Math.ceil(
        (cooldownEndTime - Date.now()) / (60 * 1000)
      );
      setErrorMessage(
        `Too many attempts. Try again in ${remainingMinutes} minute${
          remainingMinutes !== 1 ? "s" : ""
        }.`
      );
      return;
    }

    // Check rate limit
    if (isResend && resendCount >= MAX_RESEND_ATTEMPTS) {
      const cooldownEnd = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(cooldownEnd);
      setErrorMessage(`Too many attempts. Try again in 10 minutes.`);
      return;
    }

    setSendingOtp(true);
    setErrorMessage(null);
    setResendSuccessMessage(null);

    try {
      // Check if aborted before making the request
      if (signal?.aborted) return;

      const result = await enrollmentModule.sendPatientOtp(
        formDataForAuth,
        config,
        storageKey
      );

      // Check if aborted after the request
      if (signal?.aborted) return;

      if (result.success) {
        setResendCountdown(RESEND_COOLDOWN_SECONDS);

        if (isResend) {
          setResendCount((prev) => prev + 1);
          setResendSuccessMessage(
            "Code resent! Check your spam folder if you don't see it."
          );
          setTimeout(() => setResendSuccessMessage(null), 5000);
        }

        if (result.isFirstTimeUser && result.token && result.patient) {
          // First-time user with complete profile - skip OTP verification
          const authResults = enrollmentModule.buildPatientAuthResults(
            result.patient,
            result.token
          );
          const finalResult = {...authResults, "canGoNext": true}
          onChange?.(finalResult as any);
          goToNextBlock({ [block.fieldName as any]: finalResult });
        }
      } else {
        setErrorMessage(result.error || "Failed to send verification code");
      }
    } finally {
      setSendingOtp(false);
    }
  };

  // Common validation handler
  const handleValidateAuth = async () => {
    if (!enrollmentModule) {
      setErrorMessage("Enrollment module not initialized");
      return;
    }

    if (authMethod === "otp") {
      setVerifyingOtp(true);
    } else {
      setVerifyingPassword(true);
    }
    setErrorMessage(null);

    const result = await enrollmentModule.validatePatientAuth(
      formDataForAuth,
      config,
      storageKey
    );

    if (result.success && result.patient) {
      if (result.missingFields && result.missingFields.length > 0) {
        setErrorMessage(
          "You have incomplete steps. Please complete them to continue: " +
            result.missingFields?.join(", ")
        );
      } else if (result.token) {
        const authResults = enrollmentModule.buildPatientAuthResults(
          result.patient,
          result.token
        );
        const finalResult = {...authResults, "otp": otp, "canGoNext": true}
        onChange?.(finalResult as any);
        goToNextBlock({ [block.fieldName as any]: finalResult });
      } else {
        setErrorMessage("Authentication failed: No token received");
      }
    } else {
      setErrorMessage(result.error || "Authentication failed");
    }

    if (authMethod === "otp") {
      setVerifyingOtp(false);
    } else {
      setVerifyingPassword(false);
    }
  };

  const canSubmitVerify = () => {
    if (!enrollmentModule) return false;
    if (authMethod === "otp") {
      return enrollmentModule.isValidOtp(otp);
    } else {
      return password && password.length > 0;
    }
  };

  // Handler for continuing from "already logged in" state
  const handleContinueFromLoggedIn = () => {
    const autoSkipKey = `${block.fieldName}_${storageKey}`;
    autoSkippedBlocks.add(autoSkipKey);
    goToNextBlock({ [block.fieldName as any]: value });
  };

  // Auto-send OTP on mount if email/phone is available (OTP only)
  // useEffect(() => {
  //   if (
  //     authMethod === "otp" &&
  //     ((authField === "email" && email) || (authField === "phone" && phone))
  //   ) {
  //     handleSendOtp({ isResend: false });
  //   }
  // }, [authMethod]); // Only run when authMethod changes

  // Show loading state while checking existing auth
  if (loading) {
    return (
      <div
        className="w-full min-w-0 max-w-xl mx-auto flex flex-col gap-6 sm:gap-8 items-center justify-center"
        ref={ref}
      >
        <div className="max-w-md flex flex-col items-center justify-center gap-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: themeConfig.colors.text }} />
          </motion.div>
          <div className="space-y-2">
            <h2 className={cn(themeConfig.title, "text-2xl sm:text-3xl")}>
              Checking your authentication...
            </h2>
            <p className={cn(themeConfig.description, "text-base")}>
              Please wait while we verify your login status.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render "already logged in" UI
  if (isAlreadyLoggedIn && loggedInPatient) {
    return (
      <AlreadyLoggedIn
        patient={loggedInPatient}
        themeConfig={themeConfig}
        onContinue={handleContinueFromLoggedIn}
        loading={loading}
      />
    );
  }

  // Render OTP UI
  if (authMethod === "otp") {
    return (
      <div
        className="w-full min-w-0 max-w-xl mx-auto flex flex-col gap-6 sm:gap-8 items-center justify-center"
        ref={ref}
      >
        <div className="max-w-sm flex flex-col items-center justify-center gap-2">
          <h2 className={themeConfig.title}>Almost there</h2>
          <p className={cn(themeConfig.description)}>
            We sent a 6-digit code to your{" "}
            {authField === "phone" ? "phone" : "email"} <br /> to securely
            continue your form.
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:gap-8 max-w-xl w-full">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`${block.fieldName}-otp`}
              className={cn(themeConfig.field.label)}
            >
              Verification Code
            </Label>
            <Input
              id={`${block.fieldName}-otp`}
              type="text"
              value={otp}
              onChange={(e) => {
                const newOtp = e.target.value?.replace(/\D/g, "").slice(0, 6);
                setOtp(newOtp);
                onChange?.({ ...value, otp: newOtp } as any);
              }}
              placeholder="000000"
              className={cn(
                "h-16 text-2xl text-center tracking-[0.5em] font-mono rounded-xl border-2",
                themeConfig?.field?.input
              )}
              maxLength={6}
              autoFocus
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmitVerify()) {
                  handleValidateAuth();
                }
              }}
            />
            <div className="text-center text-sm text-muted-foreground space-y-1">
              {resendSuccessMessage && (
                <p className="text-green-600 dark:text-green-400 font-medium">
                  {resendSuccessMessage}
                </p>
              )}
              {cooldownEndTime && Date.now() < cooldownEndTime ? (
                <p className="text-destructive">
                  Too many attempts. Try again in{" "}
                  {Math.ceil((cooldownEndTime - Date.now()) / (60 * 1000))}{" "}
                  minute
                  {Math.ceil((cooldownEndTime - Date.now()) / (60 * 1000)) !== 1
                    ? "s"
                    : ""}
                  .
                </p>
              ) : resendCountdown > 0 ? (
                <p>
                  Didn't receive a code? Resend code in{" "}
                  <span className="font-medium">{resendCountdown}s</span>
                </p>
              ) : (
                <p>
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    onClick={() => handleSendOtp({ isResend: true })}
                    className="hover:underline font-medium"
                    style={{ color: themeConfig.colors.text }}
                    disabled={
                      sendingOtp ||
                      verifyingOtp ||
                      resendCount >= MAX_RESEND_ATTEMPTS
                    }
                  >
                    Resend
                  </button>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleValidateAuth}
            disabled={!canSubmitVerify() || verifyingOtp || disabled}
            className={cn(
              `w-full justify-center rounded-full px-8 py-4 sm:px-10 sm:py-5 text-white font-semibold text-sm sm:text-base transition-all duration-200 flex items-center gap-2.5`,
              !canSubmitVerify() || verifyingOtp || disabled
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-[#1C1C1C]/80 active:scale-[0.98] cursor-pointer"
            )}
            style={{
              backgroundColor: "#1C1C1C",
              boxShadow:
                "inset 0 5px 8.8px rgba(255, 255, 255, 0.25), inset 0 -8px 9.9px rgba(0, 0, 0, 0.25)",
            }}
          >
            {verifyingOtp ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Continue
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill="currentColor"
                    d="M16.175 13H5q-.425 0-.712-.288T4 12t.288-.712T5 11h11.175l-4.9-4.9q-.3-.3-.288-.7t.313-.7q.3-.275.7-.288t.7.288l6.6 6.6q.15.15.213.325t.062.375t-.062.375t-.213.325l-6.6 6.6q-.275.275-.687.275T11.3 19.3q-.3-.3-.3-.712t.3-.713z"
                  />
                </svg>
              </>
            )}
          </button>

          <ErrorMessage message={errorMessage} />

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground ">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>HIPAA Secure</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>256-bit encryption</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              <span>Private & confidential</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Password UI
  return (
    <div
      className="w-full min-w-0 max-w-xl mx-auto flex flex-col gap-6 sm:gap-8 items-center justify-center"
      ref={ref}
    >
      <div className="max-w-sm mb-6 sm:mb-8 flex flex-col items-center justify-center gap-2">
        <h2 className={themeConfig.title}>Enter Your Password</h2>
        <p className={cn(themeConfig.description)}>
          Enter your password to securely continue your form.
        </p>
      </div>
      <div className="flex flex-col gap-6 sm:gap-8 max-w-xl w-full">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`${block.fieldName}-password`}
            className={cn(themeConfig.field.label)}
          >
            Password
          </Label>
          <div className="relative">
            <Lock
              className="absolute left-6 top-1/2 transform -translate-y-1/2 w-6 h-6 stroke-[1.5px]"
              style={{ color: themeConfig.colors.text }}
            />
            <Input
              id={`${block.fieldName}-password`}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                const newPassword = e.target.value;
                setPassword(newPassword);
                onChange?.({ ...value, password: newPassword } as any);
              }}
              placeholder="Enter your password"
              style={{ paddingLeft: "4rem", paddingRight: "4rem" }}
              className={cn(
                "pl-12 pr-12 h-14 text-lg rounded-xl border-2",
                themeConfig?.field?.input
              )}
              autoFocus
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmitVerify()) {
                  handleValidateAuth();
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-0 rounded-md p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={disabled}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff className="w-6 h-6 stroke-[1.5px]" />
              ) : (
                <Eye className="w-6 h-6 stroke-[1.5px]" />
              )}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleValidateAuth}
          disabled={!canSubmitVerify() || verifyingPassword || disabled}
          className={cn(
            `w-full justify-center rounded-full px-8 py-4 sm:px-10 sm:py-5 text-white font-semibold text-sm sm:text-base transition-all duration-200 flex items-center gap-2.5`,
            !canSubmitVerify() || verifyingPassword || disabled
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-[#1C1C1C]/80 active:scale-[0.98] cursor-pointer"
          )}
          style={{
            backgroundColor: "#1C1C1C",
            boxShadow:
              "inset 0 5px 8.8px rgba(255, 255, 255, 0.25), inset 0 -8px 9.9px rgba(0, 0, 0, 0.25)",
          }}
        >
          {verifyingPassword ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Continue
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
              >
                <path
                  fill="currentColor"
                  d="M16.175 13H5q-.425 0-.712-.288T4 12t.288-.712T5 11h11.175l-4.9-4.9q-.3-.3-.288-.7t.313-.7q.3-.275.7-.288t.7.288l6.6 6.6q.15.15.213.325t.062.375t-.062.375t-.213.325l-6.6 6.6q-.275.275-.687.275T11.3 19.3q-.3-.3-.3-.712t.3-.713z"
                />
              </svg>
            </>
          )}
        </button>
        <ErrorMessage message={errorMessage} />

        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground ">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>HIPAA Secure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>256-bit encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5" />
            <span>Private & confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
});

VerificationInformationRenderer.displayName = "VerificationRenderer";

// The saved answer holds the patient's code or password and their login token, so only whether and how they
// verified is shown. A code or password check saves an `otp` key; a still valid login or a first-time patient
// whose code step was skipped saves none.
const VerificationAnswerView = ({ block, value }: AnswerViewProps) => {
  const answer = value !== null && typeof value === "object" ? value : {};
  const verified = answer.isAuthenticated === true;
  const method = !("otp" in answer)
    ? "Verified"
    : block.authMethod === "password"
      ? "Verified by password"
      : "Verified by one-time code";
  const verifiedAt = verified ? timeText(answer.timestamp) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={verified ? "default" : "secondary"}>{verified ? method : "Not verified"}</Badge>
      {verifiedAt && <span className="text-xs text-muted-foreground">{verifiedAt}</span>}
    </div>
  );
};

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

export const VerificationInformationBlock: BlockDefinition = {
  type: "verificationInformation",
  name: "Verification",
  description: "OTP or password verification step for patient authentication",
  icon: <Lock className="w-6 h-6" />,
  defaultData: {
    type: "verificationInformation",
    fieldName: "verification",
    authMethod: "otp",
    emailKey: "AuthInformation.email",
    phoneKey: "AuthInformation.phone",
    showContinueButton: false,
    authField: "email",
    storageKeyIdentifier: "",
    skipIfLoggedIn: false,
    required: true,
  },
  generateDefaultData: () => ({
    type: "verificationInformation",
    fieldName: "verification",
    authMethod: "otp",
    emailKey: "AuthInformation.email",
    phoneKey: "AuthInformation.phone",
    authField: "email",
    storageKeyIdentifier: "",
    skipIfLoggedIn: false,
    required: true,
  }),
  renderItem: (props) => <VerificationInformationItem {...props} />,
  renderFormFields: (props) => <VerificationInformationForm {...props} />,
  renderPreview: () => <VerificationInformationPreview />,
  renderBlock: (props: BlockRendererProps) => (
    <VerificationInformationRenderer {...props} />
  ),
  validate: (data: BlockData) => {
    if (!data.fieldName) return "Field name is required";
    return null;
  },
  validateValue: (value: any, data: BlockData) => {
    // const authMethod = data.authMethod || "otp";
    if(!value.canGoNext) {
      return "Waiting for Auth";
    }
    return null;
  },
  answerView: (props) => <VerificationAnswerView {...props} />,
  outputSchema: {
    type: "object",
    properties: {
      patient: {
        type: "object",
        description: "Complete patient information object",
      },
      token: {
        type: "string",
        description: "Authentication token",
      },
      isAuthenticated: {
        type: "boolean",
        description: "Whether authentication was successful",
      },
      timestamp: {
        type: "string",
        description: "ISO timestamp of authentication",
      },
    },
  },
};