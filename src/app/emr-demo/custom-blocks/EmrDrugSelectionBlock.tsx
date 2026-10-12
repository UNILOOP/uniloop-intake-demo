/* eslint-disable @typescript-eslint/no-explicit-any */

import type { EmrEnrollmentUtils, EmrPreferredDrugSelection } from '@/lib/emr-enrollment-utils';
import { Alert, AlertDescription } from '@/packages/survey-form-package/src/components/ui/alert';
import { Badge } from '@/packages/survey-form-package/src/components/ui/badge';
import { Card, CardContent } from '@/packages/survey-form-package/src/components/ui/card';
import { Checkbox } from '@/packages/survey-form-package/src/components/ui/checkbox';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/packages/survey-form-package/src/components/ui/radio-group';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';
import type { BlockDefinition, BlockRendererProps, ContentBlockItemProps } from '@/packages/survey-form-package/src/types';
import { AlertCircle, Check, CheckCircle2, Pill, Plus, Shield, Sparkles } from 'lucide-react';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

type EnrollmentModule = any;

const formatCurrency = (amount: number | string | null | undefined, currency = 'USD'): string => {
    const value = Number(amount) || 0;

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `$${value.toFixed(2)}`;
    }
};

const phaseRange = (from: number, to: number | null): string => {
    if (to === null) {
        return `Cycle ${from}+`;
    }

    if (from === to) {
        return `Cycle ${from}`;
    }

    return `Cycles ${from}-${to}`;
};

const withAlpha = (color: string | null | undefined, alpha: number): string | undefined => {
    if (!color) {
        return undefined;
    }

    const normalized = color.trim();
    const hex = normalized.replace('#', '');

    if (/^[0-9a-fA-F]{3}$/.test(hex) || /^[0-9a-fA-F]{6}$/.test(hex)) {
        const expanded =
            hex.length === 3
                ? hex
                      .split('')
                      .map((char) => char + char)
                      .join('')
                : hex;
        const red = Number.parseInt(expanded.slice(0, 2), 16);
        const green = Number.parseInt(expanded.slice(2, 4), 16);
        const blue = Number.parseInt(expanded.slice(4, 6), 16);

        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    return `color-mix(in srgb, ${normalized} ${Math.round(alpha * 100)}%, transparent)`;
};

const getPrimaryPhoto = (photos: Array<{ url?: string | null; is_primary?: boolean }> | null | undefined): string | null => {
    if (!photos?.length) {
        return null;
    }

    const primaryPhoto = photos.find((photo) => photo.is_primary);

    return primaryPhoto?.url ?? photos[0]?.url ?? null;
};

const getDrugImage = (drug: any): string | null => getPrimaryPhoto(drug?.merchant_drug?.photos);

const getPhaseImage = (phase: any, drug: any): string | null => {
    return getPrimaryPhoto(phase?.local_merchant_drug?.photos) ?? getDrugImage(drug);
};

const getPhaseDrugName = (phase: any, drug: any): string => {
    return phase?.local_merchant_drug?.display_name || phase?.drug_name || drug?.drug_name || 'Medication';
};

const getActivePhases = (drug: any): any[] => {
    return drug?.has_phases ? (drug?.phases ?? []).filter((phase: any) => phase?.is_active) : [];
};

const getSelectedPhase = (drug: any, selectedPhaseId: string | null): any | null => {
    if (!selectedPhaseId) {
        return null;
    }

    return getActivePhases(drug).find((phase: any) => phase.id === selectedPhaseId) ?? null;
};

const getDrugMeta = (drug: any, phase: any | null = null): string[] => {
    return [phase?.strength ?? drug?.strength, drug?.dosage_form, phase?.frequency ?? drug?.frequency].filter(Boolean);
};

const getDrugSupportText = (drug: any, phase: any | null = null): string | null => {
    const parts = [
        phase ? phaseRange(phase.phase_from, phase.phase_to) : null,
        phase?.quantity
            ? `Qty ${phase.quantity}`
            : drug?.quantity
              ? `Qty ${drug.quantity}${drug?.quantity_unit ? ` ${drug.quantity_unit}` : ''}`
              : null,
        phase?.days_supply ? `${phase.days_supply} day supply` : drug?.days_supply ? `${drug.days_supply} day supply` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' • ') : null;
};

const getSelectionSummary = (drug: any, phase: any | null): string => {
    const summaryParts = [
        phase ? phaseRange(phase.phase_from, phase.phase_to) : 'Standard dose',
        phase?.strength ?? drug?.strength,
        phase?.frequency ?? drug?.frequency,
    ].filter(Boolean);

    return summaryParts.join(' • ');
};

const getMedicationDisplay = (drug: any, selectedPhaseId: string | null) => {
    const phase = getSelectedPhase(drug, selectedPhaseId);

    return {
        title: phase ? getPhaseDrugName(phase, drug) : drug?.drug_name || 'Medication',
        imageUrl: phase ? getPhaseImage(phase, drug) : getDrugImage(drug),
        description: drug?.merchant_drug?.description ?? null,
        meta: getDrugMeta(drug, phase),
        supportText: getDrugSupportText(drug, phase),
        summary: getSelectionSummary(drug, phase),
        phase,
    };
};

const getSoftCardStyle = (primaryColor: string): React.CSSProperties => ({
    borderColor: withAlpha(primaryColor, 0.16),
    backgroundColor: withAlpha(primaryColor, 0.04),
});

const getSelectedCardStyle = (primaryColor: string): React.CSSProperties => ({
    borderColor: withAlpha(primaryColor, 0.26),
    backgroundColor: withAlpha(primaryColor, 0.08),
    boxShadow: `0 16px 40px ${withAlpha(primaryColor, 0.1)}`,
});

const MetaChips: React.FC<{ items: string[] }> = ({ items }) => {
    const visibleItems = items.filter(Boolean);

    if (visibleItems.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {visibleItems.map((item) => (
                <span
                    key={item}
                    className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium"
                >
                    {item}
                </span>
            ))}
        </div>
    );
};

const MediaThumb: React.FC<{
    imageUrl: string | null;
    label: string;
    primaryColor: string;
    size?: 'sm' | 'md' | 'lg';
}> = ({ imageUrl, label, primaryColor, size = 'md' }) => {
    const sizeClass = {
        sm: 'size-12 rounded-2xl',
        md: 'size-14 rounded-[20px]',
        lg: 'size-16 rounded-[22px]',
    }[size];

    if (imageUrl) {
        return <img src={imageUrl} alt={label} className={cn('shrink-0 object-cover', sizeClass)} />;
    }

    return (
        <div
            className={cn('flex shrink-0 items-center justify-center border', sizeClass)}
            style={{
                backgroundColor: withAlpha(primaryColor, 0.1),
                borderColor: withAlpha(primaryColor, 0.16),
            }}
        >
            <Pill className="size-5" style={{ color: primaryColor }} />
        </div>
    );
};

const TrustPill: React.FC<{
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    primaryColor: string;
}> = ({ icon: Icon, label, primaryColor }) => {
    return (
        <div className="border-border bg-background text-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
            <Icon className="size-3.5" style={{ color: primaryColor }} />
            <span>{label}</span>
        </div>
    );
};

const SectionHeader: React.FC<{
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    title: string;
    description?: string | null;
    primaryColor: string;
    badge?: React.ReactNode;
}> = ({ icon: Icon, title, description, primaryColor, badge }) => {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border"
                    style={{
                        backgroundColor: withAlpha(primaryColor, 0.08),
                        borderColor: withAlpha(primaryColor, 0.18),
                    }}
                >
                    <Icon className="size-5" style={{ color: primaryColor }} />
                </div>
                <div className="space-y-1">
                    <h3 className="text-foreground text-lg font-semibold">{title}</h3>
                    {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
                </div>
            </div>
            {badge}
        </div>
    );
};

const ActionLink: React.FC<{
    children: React.ReactNode;
    onClick: () => void;
    primaryColor: string;
    active?: boolean;
    disabled?: boolean;
}> = ({ children, onClick, primaryColor, active = false, disabled = false }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'text-sm font-medium underline-offset-4 transition-colors hover:underline',
                active && 'underline',
                disabled && 'cursor-not-allowed opacity-50',
            )}
            style={{ color: primaryColor }}
        >
            {children}
        </button>
    );
};

const InlineChooserPanel: React.FC<{
    title: string;
    description?: string | null;
    primaryColor: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, description, primaryColor, action, children }) => {
    return (
        <div
            className="space-y-3 rounded-[24px] border p-3 sm:p-4"
            style={{
                backgroundColor: withAlpha(primaryColor, 0.05),
                borderColor: withAlpha(primaryColor, 0.16),
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-foreground text-sm font-semibold">{title}</p>
                    {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
};

const MedicationSummaryCard: React.FC<{
    title: string;
    imageUrl: string | null;
    primaryColor: string;
    showImages: boolean;
    meta: string[];
    description?: string | null;
    supportText?: string | null;
    summaryLabel: string;
    summaryValue: string;
    badge?: React.ReactNode;
    aside?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}> = ({
    title,
    imageUrl,
    primaryColor,
    showImages,
    meta,
    description,
    supportText,
    summaryLabel,
    summaryValue,
    badge,
    aside,
    actions,
    children,
    style,
}) => {
    return (
        <div className="bg-card space-y-4 rounded-[28px] border p-4 sm:p-5" style={style}>
            <div className="flex items-start gap-4">
                {showImages ? <MediaThumb imageUrl={imageUrl} label={title} primaryColor={primaryColor} size="lg" /> : null}

                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-foreground text-lg font-semibold">{title}</p>
                                {badge}
                            </div>
                            <MetaChips items={meta} />
                        </div>
                        {aside}
                    </div>

                    {description ? <p className="text-muted-foreground line-clamp-3 text-sm leading-6">{description}</p> : null}
                    {supportText ? <p className="text-muted-foreground text-xs">{supportText}</p> : null}

                    <div className="border-border bg-muted/50 rounded-2xl border px-3.5 py-3">
                        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">{summaryLabel}</p>
                        <p className="text-foreground mt-1 text-sm font-medium">{summaryValue}</p>
                    </div>

                    {actions ? <div className="flex flex-wrap gap-4 pt-1">{actions}</div> : null}
                </div>
            </div>

            {children}
        </div>
    );
};

const PhaseChooser: React.FC<{
    drug: any;
    selectedPhaseId: string | null;
    onSelect: (phaseId: string | null) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({ drug, selectedPhaseId, onSelect, primaryColor, showImages, showDetails, disabled = false, addOnPricing }) => {
    const activePhases = getActivePhases(drug);

    if (activePhases.length === 0) {
        return null;
    }

    return (
        <RadioGroup
            value={selectedPhaseId ?? 'standard'}
            onValueChange={(value) => onSelect(value === 'standard' ? null : value)}
            className="space-y-3"
            disabled={disabled}
        >
            <label
                className={cn(
                    'bg-card flex cursor-pointer gap-3 rounded-2xl border p-3 transition-all duration-200',
                    disabled && 'cursor-not-allowed opacity-60',
                )}
                style={selectedPhaseId === null ? getSelectedCardStyle(primaryColor) : undefined}
            >
                <RadioGroupItem value="standard" className="mt-1 shrink-0" disabled={disabled} />
                {showImages ? <MediaThumb imageUrl={getDrugImage(drug)} label={drug.drug_name} primaryColor={primaryColor} size="sm" /> : null}
                <div className="min-w-0 space-y-2">
                    <div className="space-y-1">
                        <p className="text-foreground text-sm font-semibold">Standard dose</p>
                        <p className="text-muted-foreground text-xs">{drug.drug_name}</p>
                    </div>
                    {showDetails ? <MetaChips items={getDrugMeta(drug)} /> : null}
                </div>
            </label>

            {activePhases.map((phase: any) => {
                const isSelected = selectedPhaseId === phase.id;
                const phaseAddOn =
                    addOnPricing && phase.add_on_price != null && Number(phase.add_on_price) > 0
                        ? Number(phase.add_on_price) * addOnPricing.bundleSize
                        : 0;

                return (
                    <label
                        key={phase.id}
                        className={cn(
                            'bg-card flex cursor-pointer gap-3 rounded-2xl border p-3 transition-all duration-200',
                            disabled && 'cursor-not-allowed opacity-60',
                        )}
                        style={isSelected ? getSelectedCardStyle(primaryColor) : undefined}
                    >
                        <RadioGroupItem value={phase.id} className="mt-1 shrink-0" disabled={disabled} />
                        {showImages ? (
                            <MediaThumb
                                imageUrl={getPhaseImage(phase, drug)}
                                label={getPhaseDrugName(phase, drug)}
                                primaryColor={primaryColor}
                                size="sm"
                            />
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="space-y-1">
                                    <p className="text-foreground text-sm font-semibold">{phaseRange(phase.phase_from, phase.phase_to)}</p>
                                    <p className="text-muted-foreground text-xs">{getPhaseDrugName(phase, drug)}</p>
                                </div>
                                {phaseAddOn > 0 ? (
                                    <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                        +{formatCurrency(phaseAddOn, addOnPricing!.currency)}
                                    </Badge>
                                ) : null}
                            </div>
                            {showDetails ? <MetaChips items={getDrugMeta(drug, phase)} /> : null}
                        </div>
                    </label>
                );
            })}
        </RadioGroup>
    );
};

const SingleDrugChooser: React.FC<{
    drugs: any[];
    selectedDrugId: number | null;
    onSelect: (drugId: number) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({ drugs, selectedDrugId, onSelect, primaryColor, showImages, showDetails, disabled = false, addOnPricing }) => {
    return (
        <div className="space-y-3">
            {drugs.map((drug) => {
                const isSelected = selectedDrugId === drug.id;
                const addOn = addOnPricing && Number(drug.add_on_price ?? 0) > 0 ? Number(drug.add_on_price) * addOnPricing.bundleSize : 0;

                return (
                    <button
                        key={drug.id}
                        type="button"
                        onClick={() => onSelect(drug.id)}
                        disabled={disabled}
                        className={cn(
                            'bg-card flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all duration-200',
                            !disabled && 'hover:-translate-y-0.5 hover:shadow-md',
                            disabled && 'cursor-not-allowed opacity-60',
                        )}
                        style={isSelected ? getSelectedCardStyle(primaryColor) : undefined}
                    >
                        {showImages ? (
                            <MediaThumb imageUrl={getDrugImage(drug)} label={drug.drug_name} primaryColor={primaryColor} size="sm" />
                        ) : null}

                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-foreground text-sm font-semibold">{drug.drug_name}</p>
                                {isSelected ? (
                                    <Badge
                                        className="rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold"
                                        style={{
                                            backgroundColor: withAlpha(primaryColor, 0.12),
                                            color: primaryColor,
                                        }}
                                    >
                                        Selected
                                    </Badge>
                                ) : null}
                                {addOn > 0 ? (
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                        +{formatCurrency(addOn, addOnPricing!.currency)}
                                    </Badge>
                                ) : null}
                            </div>
                            {showDetails ? <MetaChips items={getDrugMeta(drug)} /> : null}
                            {drug?.merchant_drug?.description ? (
                                <p className="text-muted-foreground line-clamp-2 text-xs leading-5">{drug.merchant_drug.description}</p>
                            ) : null}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const MultiDrugChooser: React.FC<{
    group: any;
    selectedDrugIds: number[];
    onToggle: (drugId: number) => void;
    onDone: () => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    disabled?: boolean;
}> = ({ group, selectedDrugIds, onToggle, onDone, primaryColor, showImages, showDetails, disabled = false }) => {
    return (
        <InlineChooserPanel
            title="Add or remove alternatives"
            description="Select all the drugs you want active in this group."
            primaryColor={primaryColor}
            action={
                <ActionLink primaryColor={primaryColor} onClick={onDone}>
                    Done
                </ActionLink>
            }
        >
            <div className="space-y-3">
                {group.drugs.map((drug: any) => {
                    const isSelected = selectedDrugIds.includes(drug.id);
                    const isLockedRequiredSelection = group.is_required && selectedDrugIds.length === 1 && isSelected;

                    return (
                        <button
                            key={drug.id}
                            type="button"
                            onClick={() => onToggle(drug.id)}
                            disabled={disabled || isLockedRequiredSelection}
                            className={cn(
                                'bg-card flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all duration-200',
                                !disabled && !isLockedRequiredSelection && 'hover:-translate-y-0.5 hover:shadow-md',
                                (disabled || isLockedRequiredSelection) && 'cursor-not-allowed opacity-60',
                            )}
                            style={isSelected ? getSelectedCardStyle(primaryColor) : undefined}
                        >
                            <Checkbox checked={isSelected} className="pointer-events-none mt-1 shrink-0" />
                            {showImages ? (
                                <MediaThumb imageUrl={getDrugImage(drug)} label={drug.drug_name} primaryColor={primaryColor} size="sm" />
                            ) : null}

                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-foreground text-sm font-semibold">{drug.drug_name}</p>
                                    {isLockedRequiredSelection ? (
                                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                            Required
                                        </Badge>
                                    ) : null}
                                </div>
                                {showDetails ? <MetaChips items={getDrugMeta(drug)} /> : null}
                                {drug?.merchant_drug?.description ? (
                                    <p className="text-muted-foreground line-clamp-2 text-xs leading-5">{drug.merchant_drug.description}</p>
                                ) : null}
                            </div>
                        </button>
                    );
                })}
            </div>
        </InlineChooserPanel>
    );
};

const IncludedDrugCard: React.FC<{
    drug: any;
    selectedPhaseId: string | null;
    onPhaseChange: (phaseId: string | null) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    showPhases: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({ drug, selectedPhaseId, onPhaseChange, primaryColor, showImages, showDetails, showPhases, disabled = false, addOnPricing }) => {
    const [isPhaseChooserOpen, setIsPhaseChooserOpen] = useState(false);
    const display = getMedicationDisplay(drug, selectedPhaseId);
    const hasPhases = getActivePhases(drug).length > 0;

    // Standalone drugs: only phases have add-on pricing
    let phaseAddOn = 0;
    if (addOnPricing && selectedPhaseId && drug.has_phases && drug.phases?.length > 0) {
        const selectedPhase = drug.phases.find((p: any) => p.id === selectedPhaseId);
        if (selectedPhase?.add_on_price != null && Number(selectedPhase.add_on_price) > 0) {
            phaseAddOn = Number(selectedPhase.add_on_price) * addOnPricing.bundleSize;
        }
    }

    return (
        <MedicationSummaryCard
            title={display.title}
            imageUrl={display.imageUrl}
            primaryColor={primaryColor}
            showImages={showImages}
            meta={showDetails ? display.meta : []}
            description={display.description}
            supportText={showDetails ? display.supportText : null}
            summaryLabel="Current dosage"
            summaryValue={display.summary}
            style={getSoftCardStyle(primaryColor)}
            badge={
                <Badge
                    className="rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold"
                    style={{
                        backgroundColor: withAlpha(primaryColor, 0.12),
                        color: primaryColor,
                    }}
                >
                    <Check className="mr-1 size-3" />
                    Included
                </Badge>
            }
            aside={
                phaseAddOn > 0 ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                        +{formatCurrency(phaseAddOn, addOnPricing!.currency)}
                    </Badge>
                ) : null
            }
            actions={
                showPhases && hasPhases ? (
                    <ActionLink
                        primaryColor={primaryColor}
                        active={isPhaseChooserOpen}
                        disabled={disabled}
                        onClick={() => setIsPhaseChooserOpen((value) => !value)}
                    >
                        Change Dosage
                    </ActionLink>
                ) : undefined
            }
        >
            {showPhases && hasPhases && isPhaseChooserOpen ? (
                <InlineChooserPanel
                    title="Choose titration cycle"
                    description="Select the dosage path you want shown for this medication."
                    primaryColor={primaryColor}
                >
                    <PhaseChooser
                        drug={drug}
                        selectedPhaseId={selectedPhaseId}
                        onSelect={(phaseId) => {
                            onPhaseChange(phaseId);
                            setIsPhaseChooserOpen(false);
                        }}
                        primaryColor={primaryColor}
                        showImages={showImages}
                        showDetails={showDetails}
                        disabled={disabled}
                        addOnPricing={addOnPricing}
                    />
                </InlineChooserPanel>
            ) : null}
        </MedicationSummaryCard>
    );
};

const OptionalDrugCard: React.FC<{
    drug: any;
    isSelected: boolean;
    selectedPhaseId: string | null;
    onToggle: () => void;
    onPhaseChange: (phaseId: string | null) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    showPhases: boolean;
    currency: string;
    price: number;
    disabled?: boolean;
}> = ({
    drug,
    isSelected,
    selectedPhaseId,
    onToggle,
    onPhaseChange,
    primaryColor,
    showImages,
    showDetails,
    showPhases,
    currency,
    price,
    disabled = false,
}) => {
    const [isPhaseChooserOpen, setIsPhaseChooserOpen] = useState(false);
    const effectivePhaseId = isSelected ? selectedPhaseId : null;
    const display = getMedicationDisplay(drug, effectivePhaseId);
    const hasPhases = getActivePhases(drug).length > 0;

    return (
        <MedicationSummaryCard
            title={display.title}
            imageUrl={display.imageUrl}
            primaryColor={primaryColor}
            showImages={showImages}
            meta={showDetails ? display.meta : []}
            description={display.description}
            supportText={showDetails ? display.supportText : null}
            summaryLabel={isSelected ? 'Current dosage' : 'Status'}
            summaryValue={isSelected ? display.summary : 'Not added to your plan yet'}
            style={isSelected ? getSelectedCardStyle(primaryColor) : undefined}
            badge={
                isSelected ? (
                    <Badge
                        className="rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                            backgroundColor: withAlpha(primaryColor, 0.12),
                            color: primaryColor,
                        }}
                    >
                        Added
                    </Badge>
                ) : undefined
            }
            aside={
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                    +{formatCurrency(price, currency)}
                </Badge>
            }
            actions={
                <>
                    <ActionLink
                        primaryColor={primaryColor}
                        disabled={disabled}
                        onClick={() => {
                            onToggle();
                            if (isSelected) {
                                setIsPhaseChooserOpen(false);
                            }
                        }}
                    >
                        {isSelected ? 'Remove medication' : 'Add medication'}
                    </ActionLink>
                    {isSelected && showPhases && hasPhases ? (
                        <ActionLink
                            primaryColor={primaryColor}
                            active={isPhaseChooserOpen}
                            disabled={disabled}
                            onClick={() => setIsPhaseChooserOpen((value) => !value)}
                        >
                            Change Dosage
                        </ActionLink>
                    ) : null}
                </>
            }
        >
            {isSelected && showPhases && hasPhases && isPhaseChooserOpen ? (
                <InlineChooserPanel
                    title="Choose Dosage"
                    description="Select the dosage path you want shown for this add-on medication."
                    primaryColor={primaryColor}
                >
                    <PhaseChooser
                        drug={drug}
                        selectedPhaseId={selectedPhaseId}
                        onSelect={(phaseId) => {
                            onPhaseChange(phaseId);
                            setIsPhaseChooserOpen(false);
                        }}
                        primaryColor={primaryColor}
                        showImages={showImages}
                        showDetails={showDetails}
                        disabled={disabled}
                    />
                </InlineChooserPanel>
            ) : null}
        </MedicationSummaryCard>
    );
};

const SingleGroupSelectionCard: React.FC<{
    group: any;
    selectedDrug: any | null;
    selectedPhaseId: string | null;
    onSelectDrug: (drugId: number) => void;
    onPhaseChange: (phaseId: string | null) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    showPhases: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({
    group,
    selectedDrug,
    selectedPhaseId,
    onSelectDrug,
    onPhaseChange,
    primaryColor,
    showImages,
    showDetails,
    showPhases,
    disabled = false,
    addOnPricing,
}) => {
    const [openPanel, setOpenPanel] = useState<'drug' | 'phase' | null>(null);
    const fallbackDrug = group.drugs.find((drug: any) => drug.is_default_option) ?? group.drugs[0] ?? null;
    const visibleDrug = selectedDrug ?? fallbackDrug;

    if (!visibleDrug) {
        return null;
    }

    const display = getMedicationDisplay(visibleDrug, selectedDrug ? selectedPhaseId : null);
    const hasPhases = getActivePhases(visibleDrug).length > 0;

    // Resolve effective add-on: phase override takes priority over drug-level add-on
    let effectiveAddOnUnit = Number(visibleDrug.add_on_price ?? 0);
    if (selectedPhaseId && visibleDrug.has_phases && visibleDrug.phases?.length > 0) {
        const selectedPhase = visibleDrug.phases.find((p: any) => p.id === selectedPhaseId);
        if (selectedPhase?.add_on_price != null) {
            effectiveAddOnUnit = Number(selectedPhase.add_on_price);
        }
    }
    const addOn = addOnPricing && effectiveAddOnUnit > 0 ? effectiveAddOnUnit * addOnPricing.bundleSize : 0;

    return (
        <MedicationSummaryCard
            title={display.title}
            imageUrl={display.imageUrl}
            primaryColor={primaryColor}
            showImages={showImages}
            meta={showDetails ? display.meta : []}
            description={display.description}
            supportText={showDetails ? display.supportText : null}
            summaryLabel={selectedDrug ? 'Current dosage' : 'Status'}
            summaryValue={selectedDrug ? display.summary : 'No drug selected yet'}
            style={selectedDrug ? getSelectedCardStyle(primaryColor) : undefined}
            badge={
                selectedDrug ? undefined : (
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px]">
                        Choose one
                    </Badge>
                )
            }
            aside={
                addOn > 0 ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                        +{formatCurrency(addOn)}
                    </Badge>
                ) : null
            }
            actions={
                <>
                    <ActionLink
                        primaryColor={primaryColor}
                        active={openPanel === 'drug'}
                        disabled={disabled}
                        onClick={() => setOpenPanel((value) => (value === 'drug' ? null : 'drug'))}
                    >
                        See other options
                    </ActionLink>
                    {selectedDrug && showPhases && hasPhases ? (
                        <ActionLink
                            primaryColor={primaryColor}
                            active={openPanel === 'phase'}
                            disabled={disabled}
                            onClick={() => setOpenPanel((value) => (value === 'phase' ? null : 'phase'))}
                        >
                            Change Dosage
                        </ActionLink>
                    ) : null}
                </>
            }
        >
            {openPanel === 'drug' ? (
                <InlineChooserPanel
                    title="Choose a different drug"
                    description="Review alternatives and switch the currently selected drug for this group."
                    primaryColor={primaryColor}
                >
                    <SingleDrugChooser
                        drugs={group.drugs}
                        selectedDrugId={selectedDrug?.id ?? null}
                        onSelect={(drugId) => {
                            onSelectDrug(drugId);
                            setOpenPanel(null);
                        }}
                        primaryColor={primaryColor}
                        showImages={showImages}
                        showDetails={showDetails}
                        disabled={disabled}
                        addOnPricing={addOnPricing}
                    />
                </InlineChooserPanel>
            ) : null}

            {openPanel === 'phase' && selectedDrug && showPhases && hasPhases ? (
                <InlineChooserPanel
                    title="Choose titration cycle"
                    description="Update the dosage path for the currently selected drug."
                    primaryColor={primaryColor}
                >
                    <PhaseChooser
                        drug={selectedDrug}
                        selectedPhaseId={selectedPhaseId}
                        onSelect={(phaseId) => {
                            onPhaseChange(phaseId);
                            setOpenPanel(null);
                        }}
                        primaryColor={primaryColor}
                        showImages={showImages}
                        showDetails={showDetails}
                        disabled={disabled}
                        addOnPricing={addOnPricing}
                    />
                </InlineChooserPanel>
            ) : null}
        </MedicationSummaryCard>
    );
};

const MultiGroupSelectedDrugCard: React.FC<{
    drug: any;
    selectedPhaseId: string | null;
    onPhaseChange: (phaseId: string | null) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    showPhases: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({ drug, selectedPhaseId, onPhaseChange, primaryColor, showImages, showDetails, showPhases, disabled = false, addOnPricing }) => {
    const [isPhaseChooserOpen, setIsPhaseChooserOpen] = useState(false);
    const display = getMedicationDisplay(drug, selectedPhaseId);
    const hasPhases = getActivePhases(drug).length > 0;

    // Resolve effective add-on: phase override takes priority
    let effectiveAddOnUnit = Number(drug.add_on_price ?? 0);
    if (selectedPhaseId && drug.has_phases && drug.phases?.length > 0) {
        const selectedPhase = drug.phases.find((p: any) => p.id === selectedPhaseId);
        if (selectedPhase?.add_on_price != null) {
            effectiveAddOnUnit = Number(selectedPhase.add_on_price);
        }
    }
    const addOn = addOnPricing && effectiveAddOnUnit > 0 ? effectiveAddOnUnit * addOnPricing.bundleSize : 0;

    return (
        <MedicationSummaryCard
            title={display.title}
            imageUrl={display.imageUrl}
            primaryColor={primaryColor}
            showImages={showImages}
            meta={showDetails ? display.meta : []}
            description={display.description}
            supportText={showDetails ? display.supportText : null}
            summaryLabel="Current dosage"
            summaryValue={display.summary}
            style={getSelectedCardStyle(primaryColor)}
            aside={
                addOn > 0 ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                        +{formatCurrency(addOn, addOnPricing!.currency)}
                    </Badge>
                ) : null
            }
            actions={
                showPhases && hasPhases ? (
                    <ActionLink
                        primaryColor={primaryColor}
                        active={isPhaseChooserOpen}
                        disabled={disabled}
                        onClick={() => setIsPhaseChooserOpen((value) => !value)}
                    >
                        Change Dosage
                    </ActionLink>
                ) : undefined
            }
        >
            {showPhases && hasPhases && isPhaseChooserOpen ? (
                <InlineChooserPanel
                    title="Choose Dosage"
                    description="Update the dosage path for this selected alternative."
                    primaryColor={primaryColor}
                >
                    <PhaseChooser
                        drug={drug}
                        selectedPhaseId={selectedPhaseId}
                        onSelect={(phaseId) => {
                            onPhaseChange(phaseId);
                            setIsPhaseChooserOpen(false);
                        }}
                        primaryColor={primaryColor}
                        showImages={showImages}
                        showDetails={showDetails}
                        disabled={disabled}
                        addOnPricing={addOnPricing}
                    />
                </InlineChooserPanel>
            ) : null}
        </MedicationSummaryCard>
    );
};

const VariantSelector: React.FC<{
    selectedId: string | null;
    onSelect: (variantId: string, billingOptionId: number | null) => void;
    enrollmentModule: any;
    primaryColor: string;
    currency: string;
    disabled?: boolean;
}> = ({ selectedId, onSelect, enrollmentModule, currency, disabled = false }) => {
    const choices = enrollmentModule.getEmrBillingChoices();
    const billingOptionId = enrollmentModule.getSelectedEmrBillingOptionId();
    const selected = choices.find((choice: any) => choice.variantId === selectedId && choice.billingOptionId === billingOptionId);
    return (
        <Card>
            <CardContent className="space-y-4 p-5">
                <div>
                    <h3 className="text-lg font-semibold">Choose your plan</h3>
                    <p className="text-muted-foreground text-sm">
                        Choose pay per refill or prepay for several supplies. Your clinical schedule follows the selected variant.
                    </p>
                </div>
                {!choices.length ? (
                    <Alert>
                        <AlertDescription>No purchase options are available for this treatment.</AlertDescription>
                    </Alert>
                ) : (
                    <RadioGroup
                        value={selected?.key ?? ''}
                        onValueChange={(key) => {
                            const choice = choices.find((item: any) => item.key === key);
                            if (choice) onSelect(choice.variantId, choice.billingOptionId);
                        }}
                        disabled={disabled}
                    >
                        {choices.map((choice: any) => (
                            <label key={choice.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                                <RadioGroupItem value={choice.key} disabled={disabled} />
                                <span className="flex-1">
                                    <span className="block font-semibold">{choice.label}</span>
                                    <span className="text-muted-foreground text-sm">
                                        {choice.billingOptionId
                                            ? `${choice.supplyCount} supplies · ${enrollmentModule.getVariantLabel(choice.variant)}`
                                            : 'Pay per refill'}
                                    </span>
                                </span>
                                <span className="font-semibold">{formatCurrency(choice.price, currency)}</span>
                            </label>
                        ))}
                    </RadioGroup>
                )}
            </CardContent>
        </Card>
    );
};

const PricingSummary: React.FC<{
    enrollmentModule: EnrollmentModule;
    primaryColor: string;
    currency: string;
}> = ({ enrollmentModule, primaryColor, currency }) => {
    const state = enrollmentModule.getEmrCheckoutSelectionState();

    if (!state) {
        return null;
    }

    const billingChoice = enrollmentModule
        .getEmrBillingChoices(state.variantId)
        .find((choice: any) => choice.billingOptionId === state.billingOptionId);
    const prepaid = billingChoice?.billingOptionId != null;
    const displayedTotal = prepaid ? billingChoice.price : state.total;
    const variantPrice = prepaid ? billingChoice.price : Number(state.variant?.price ?? state.variant?.calculated_price ?? 0) || 0;
    const pricingBundleSize = Math.max(1, state.variant?.default_dispense_bundle_size ?? 1);
    const optionalDrugs = enrollmentModule.getOptionalDrugs().filter((drug: any) => enrollmentModule.isOptionalDrugSelected(drug.id));

    return (
        <Card className="border-border bg-card overflow-hidden">
            <div
                className="border-b px-5 py-4"
                style={{
                    backgroundImage: `linear-gradient(140deg, ${withAlpha(primaryColor, 0.14)} 0%, ${withAlpha(primaryColor, 0.04)} 60%, transparent 100%)`,
                    borderColor: withAlpha(primaryColor, 0.12),
                }}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Plan summary</p>
                        <p className="text-foreground text-xl font-semibold">Everything in your current selection</p>
                        <p className="text-muted-foreground text-sm">Pricing updates live as you change the medication mix.</p>
                    </div>

                    <div className="text-left sm:text-right">
                        {!prepaid && state.compareAtPrice != null && Number(state.compareAtPrice) > state.total ? (
                            <p className="text-muted-foreground text-sm line-through">{formatCurrency(state.compareAtPrice, currency)}</p>
                        ) : null}
                        <p className="text-3xl font-semibold" style={{ color: primaryColor }}>
                            {formatCurrency(displayedTotal, currency)}
                        </p>
                        {state.scheduleLabel ? (
                            <p className="text-muted-foreground text-xs">
                                {prepaid
                                    ? `Base price for ${billingChoice.supplyCount} supplies · confirmed at checkout`
                                    : `Billed ${String(state.scheduleLabel).toLowerCase()}`}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <CardContent className="space-y-4 p-5">
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                            <p className="text-foreground font-medium">{prepaid ? billingChoice.label : (state.variant?.name ?? 'Selected plan')}</p>
                            <p className="text-muted-foreground text-xs">Includes all core prescribed medications</p>
                        </div>
                        <p className="text-foreground font-semibold">{formatCurrency(variantPrice, currency)}</p>
                    </div>

                    {!prepaid && state.addOnTotal > 0 ? (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <div>
                                <p className="text-foreground font-medium">Drug selection add-ons</p>
                                <p className="text-muted-foreground text-xs">Based on your medication choices</p>
                            </div>
                            <p className="text-foreground font-semibold">+{formatCurrency(state.addOnTotal, currency)}</p>
                        </div>
                    ) : null}

                    {!prepaid &&
                        optionalDrugs.map((drug: any) => (
                            <div key={drug.id} className="flex items-center justify-between gap-3 text-sm">
                                <div>
                                    <p className="text-foreground font-medium">{drug.drug_name}</p>
                                    <p className="text-muted-foreground text-xs">Optional add-on</p>
                                </div>
                                <p className="text-foreground font-semibold">
                                    +{formatCurrency(enrollmentModule.getDrugPrice(drug) * pricingBundleSize, currency)}
                                </p>
                            </div>
                        ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    <TrustPill icon={Shield} label="Licensed providers" primaryColor={primaryColor} />
                    <TrustPill icon={CheckCircle2} label="Transparent pricing" primaryColor={primaryColor} />
                </div>
            </CardContent>
        </Card>
    );
};

const EmrDrugSelectionBlockForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
    const handle = (field: string, value: any) => onUpdate?.({ ...data, [field]: value });

    return (
        <div className="space-y-3 text-sm">
            <div>
                <Label>Field Name</Label>
                <Input value={data.fieldName ?? ''} onChange={(event) => handle('fieldName', event.target.value)} placeholder="emrDrugSelection" />
            </div>

            <div className="flex items-center gap-2">
                <Checkbox checked={data.showPricing ?? true} onCheckedChange={(value) => handle('showPricing', Boolean(value))} />
                <Label>Show Pricing Summary</Label>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox checked={data.showTitrationPhases ?? true} onCheckedChange={(value) => handle('showTitrationPhases', Boolean(value))} />
                <Label>Show Titration Phase Options</Label>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox checked={data.showDrugDetails ?? true} onCheckedChange={(value) => handle('showDrugDetails', Boolean(value))} />
                <Label>Show Drug Details (Dosage, Frequency)</Label>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox checked={data.showImages ?? true} onCheckedChange={(value) => handle('showImages', Boolean(value))} />
                <Label>Show Drug Images</Label>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox checked={data.required ?? true} onCheckedChange={(value) => handle('required', Boolean(value))} />
                <Label>Required</Label>
            </div>
        </div>
    );
};

const EmrDrugSelectionBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => {
    return (
        <div className="flex items-center gap-2 text-sm text-slate-600">
            <Pill className="h-4 w-4" />
            <span>{data.fieldName || 'emrDrugSelection'}</span>
            <Badge variant="secondary" className="text-[10px]">
                EMR Drugs
            </Badge>
        </div>
    );
};

const EmrDrugSelectionBlockPreview: React.FC = () => {
    return <div className="text-xs text-slate-400 italic">EMR Drug Selection (requires enrollment module)</div>;
};

const EmrDrugSelectionRenderer = forwardRef<HTMLDivElement, BlockRendererProps>(({ block, onChange, error, disabled, theme }, ref) => {
    const { customData } = useSurveyForm();
    const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule) as EnrollmentModule | undefined;

    const themeConfig = theme ?? themes.default;
    const primaryColor = themeConfig.colors.primary || '#10b981';

    const showPricing = block?.showPricing ?? true;
    const showPhases = block?.showTitrationPhases ?? true;
    const showDetails = block?.showDrugDetails ?? true;
    const showImages = block?.showImages ?? true;
    const isEmr = Boolean(enrollmentModule?.isEmr);

    const [renderKey, setRenderKey] = useState(0);
    const [recommendation, setRecommendation] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });
    const manualChoiceVersion = useRef(0);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const emitOutputValue = useCallback(() => {
        if (!enrollmentModule?.isEmr) {
            return;
        }

        const state = enrollmentModule.getEmrCheckoutSelectionState();

        if (!state) {
            return;
        }

        const standaloneDrugs = enrollmentModule.getStandaloneDrugs();
        const groups = enrollmentModule.getDrugGroups();
        const optionalDrugs = enrollmentModule.getOptionalDrugs();

        const outputValue = {
            billingOptionId: state.billingOptionId,
            variantId: state.variantId,
            variantName: state.variant?.name ?? null,
            variantPrice: Number(state.variant?.price ?? state.variant?.calculated_price ?? 0) || 0,
            scheduleLabel: state.scheduleLabel,
            scheduleType: state.scheduleType,
            standaloneDrugs: standaloneDrugs.map((drug: any) => ({
                drugId: drug.id,
                drugName: drug.drug_name,
                phaseId: enrollmentModule.getStandaloneDrugPhase(drug.id),
            })),
            groupSelections: groups.map((group: any) => {
                const selectedDrugIds = enrollmentModule.getDrugGroupSelection(group.id);
                const selectedDrugs = group.drugs
                    .filter((drug: any) => selectedDrugIds.includes(drug.id))
                    .map((drug: any) => ({
                        drugId: drug.id,
                        drugName: drug.drug_name,
                        phaseId: enrollmentModule.getGroupDrugPhase(group.id, drug.id),
                    }));

                return {
                    groupId: group.id,
                    groupName: group.name,
                    selectionType: group.selection_type,
                    isRequired: group.is_required,
                    selectedDrugId: selectedDrugs[0]?.drugId ?? null,
                    selectedDrugName: selectedDrugs[0]?.drugName ?? null,
                    phaseId: selectedDrugs[0]?.phaseId ?? null,
                    selectedDrugIds: selectedDrugs.map((drug: any) => drug.drugId),
                    selectedDrugs,
                };
            }),
            optionalDrugs: optionalDrugs
                .filter((drug: any) => enrollmentModule.isOptionalDrugSelected(drug.id))
                .map((drug: any) => {
                    const bs = Math.max(1, state.variant?.default_dispense_bundle_size ?? 1);
                    return {
                        drugId: drug.id,
                        drugName: drug.drug_name,
                        phaseId: enrollmentModule.getOptionalDrugPhase(drug.id),
                        price: enrollmentModule.getDrugPrice(drug) * bs,
                    };
                }),
            total: state.total,
        };

        onChangeRef.current?.(outputValue as any);
    }, [enrollmentModule]);

    const update = useCallback(
        (callback: () => void) => {
            manualChoiceVersion.current++;
            callback();
            setRenderKey((value) => value + 1);
            queueMicrotask(() => emitOutputValue());
        },
        [emitOutputValue],
    );

    useEffect(() => {
        queueMicrotask(() => emitOutputValue());
    }, [emitOutputValue]);

    const variants = isEmr ? enrollmentModule.getVariants() : [];
    const standaloneDrugs = isEmr ? enrollmentModule.getStandaloneDrugs() : [];
    const drugGroups = isEmr ? enrollmentModule.getDrugGroups() : [];
    const optionalDrugs = isEmr ? enrollmentModule.getOptionalDrugs() : [];
    const state = isEmr ? enrollmentModule.getEmrCheckoutSelectionState() : null;
    const treatment = enrollmentModule?.treatment;
    const merchant = enrollmentModule?.merchant;
    const currency = treatment?.currency || 'USD';
    const bundleSize = Math.max(1, state?.variant?.default_dispense_bundle_size ?? 1);
    const selectedOptionalCount = state?.drugSelection?.selectedOptionalDrugIds?.length ?? 0;
    const selectedMedicationCount = state?.selectedDrugs?.length ?? standaloneDrugs.length;
    const selectedBillingChoice = state
        ? enrollmentModule.getEmrBillingChoices(state.variantId).find((choice: any) => choice.billingOptionId === state.billingOptionId)
        : null;
    const displayedTotal = selectedBillingChoice?.billingOptionId != null ? selectedBillingChoice.price : (state?.total ?? 0);
    const selectedPlanLabel =
        selectedBillingChoice?.billingOptionId != null
            ? selectedBillingChoice.label
            : (state?.scheduleLabel ?? (variants.length === 1 ? enrollmentModule?.getVariantLabel(variants[0]) : 'Choose a plan'));
    const heroTitle = treatment?.name ? `Build your ${treatment.name} plan` : 'Build your treatment plan';
    const heroDescription = merchant?.name
        ? `Provider-reviewed options from ${merchant.name}. Review the plan, confirm the selected medications, and adjust dosage only where needed.`
        : 'Review the plan, confirm the selected medications, and adjust dosage only where needed.';

    useEffect(() => {
        if (!isEmr || variants.length !== 1 || enrollmentModule.getSelectedEmrVariantId()) {
            return;
        }

        enrollmentModule.setSelectedEmrVariantId(variants[0].id);
        setRenderKey((value) => value + 1);
        queueMicrotask(() => emitOutputValue());
        // The enrollment module mutates internal state, so renderKey is the deliberate trigger here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emitOutputValue, enrollmentModule, isEmr, renderKey]);

    useEffect(() => {
        if (!isEmr) {
            return;
        }

        let didUpdate = false;

        for (const group of drugGroups) {
            const selectedIds = enrollmentModule.getDrugGroupSelection(group.id);

            if (!group.is_required || selectedIds.length > 0 || group.drugs.length === 0) {
                continue;
            }

            const defaultDrug = group.drugs.find((drug: any) => drug.is_default_option) ?? group.drugs[0];

            enrollmentModule.setDrugGroupSelection(group.id, [defaultDrug.id]);
            didUpdate = true;
        }

        if (didUpdate) {
            setRenderKey((value) => value + 1);
            queueMicrotask(() => emitOutputValue());
        }
        // The enrollment module mutates internal state, so renderKey is the deliberate trigger here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emitOutputValue, enrollmentModule, isEmr, renderKey]);

    const preferredUtils = customData?.emrEnrollmentUtils as EmrEnrollmentUtils | undefined;
    const preferredInput = JSON.stringify(preferredUtils?.buildPreferredDrugFormResponses() ?? []);
    const selectedVariantId = state?.variantId ?? null;

    useEffect(() => {
        if (!preferredUtils || disabled || preferredInput === '[]') return;
        let cancelled = false;
        const choiceVersion = manualChoiceVersion.current;
        const timeout = setTimeout(async () => {
            setRecommendation({ loading: true, message: null });
            try {
                const result = await preferredUtils.resolvePreferredDrugs();
                if (cancelled) return;
                const applied = manualChoiceVersion.current === choiceVersion ? preferredUtils.applyPreferredDrugResolution() : [];
                const labels = (selections: EmrPreferredDrugSelection[]) =>
                    [
                        ...new Set(selections.map((selection) => `${selection.drugName}${selection.phaseLabel ? ` (${selection.phaseLabel})` : ''}`)),
                    ].join(', ');
                const hasMatches = result.form_results.some((form) => form.preferred_drugs.length > 0);
                setRecommendation({
                    loading: false,
                    message: applied.length
                        ? `Based on your responses, the preferred option is ${labels(applied)}. We've selected it for you. You can change your selection below.`
                        : hasMatches
                          ? 'Your responses suggest a medication preference. Review the options below; your current selection has been kept.'
                          : 'No specific medication preference was found in your responses. Choose from the options below.',
                });
                if (applied.length) {
                    setRenderKey((value) => value + 1);
                    emitOutputValue();
                }
            } catch {
                if (!cancelled)
                    setRecommendation({
                        loading: false,
                        message: 'Medication recommendations are temporarily unavailable. You can still choose from the options below.',
                    });
            }
        }, 250);
        return () => {
            clearTimeout(timeout);
            cancelled = true;
        };
    }, [preferredUtils, preferredInput, selectedVariantId, disabled, emitOutputValue]);

    if (!isEmr) {
        return (
            <div ref={ref}>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>EMR enrollment module not available.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div ref={ref} className={cn('space-y-6', disabled && 'pointer-events-none opacity-70')}>
            {(recommendation.loading || recommendation.message) && (
                <Alert aria-live="polite">
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>
                        {recommendation.loading ? 'Checking your responses for a preferred medication…' : recommendation.message}
                    </AlertDescription>
                </Alert>
            )}
            <div
                className="rounded-[30px] border px-5 py-6 shadow-sm sm:px-6"
                style={{
                    backgroundColor: withAlpha(primaryColor, 0.05) ?? 'transparent',
                    borderColor: withAlpha(primaryColor, 0.16),
                }}
            >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <TrustPill icon={Shield} label="Provider reviewed" primaryColor={primaryColor} />
                            <TrustPill icon={Pill} label="Drug images included" primaryColor={primaryColor} />
                            <TrustPill icon={Sparkles} label="Simple dosage selection" primaryColor={primaryColor} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">{heroTitle}</h2>
                            <p className="text-muted-foreground max-w-2xl text-sm leading-6 sm:text-base">{heroDescription}</p>
                        </div>
                    </div>

                    <div className="grid grid-rows-3 gap-3">
                        <div className="rounded-2xl border px-4 py-3" style={getSoftCardStyle(primaryColor)}>
                            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Selected plan</p>
                            <p className="text-foreground mt-1 text-sm font-semibold">{selectedPlanLabel}</p>
                        </div>
                        <div className="rounded-2xl border px-4 py-3" style={getSoftCardStyle(primaryColor)}>
                            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Medications</p>
                            <p className="text-foreground mt-1 text-sm font-semibold">{selectedMedicationCount} selected</p>
                        </div>
                        <div className="rounded-2xl border px-4 py-3" style={getSoftCardStyle(primaryColor)}>
                            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Current total</p>
                            <p className="text-foreground mt-1 text-sm font-semibold">
                                {showPricing && state?.variantId
                                    ? formatCurrency(displayedTotal, currency)
                                    : selectedOptionalCount > 0
                                      ? `${selectedOptionalCount} add-on${selectedOptionalCount === 1 ? '' : 's'}`
                                      : 'Updates live'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {error ? (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            <VariantSelector
                selectedId={state?.variantId ?? null}
                onSelect={(id, billingOptionId) =>
                    update(() => {
                        enrollmentModule.setSelectedEmrVariantId(id);
                        enrollmentModule.setSelectedEmrBillingOptionId(billingOptionId);
                    })
                }
                enrollmentModule={enrollmentModule}
                primaryColor={primaryColor}
                currency={currency}
                disabled={disabled}
            />

            {standaloneDrugs.length > 0 ? (
                <Card className="border-border bg-card overflow-hidden">
                    <CardContent className="space-y-4 p-5">
                        <SectionHeader
                            icon={CheckCircle2}
                            title="Included medications"
                            description="These medications are already part of the selected plan."
                            primaryColor={primaryColor}
                            badge={
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                                    {standaloneDrugs.length} included
                                </Badge>
                            }
                        />

                        <div className="space-y-4">
                            {standaloneDrugs.map((drug: any) => (
                                <IncludedDrugCard
                                    key={drug.id}
                                    drug={drug}
                                    selectedPhaseId={enrollmentModule.getStandaloneDrugPhase(drug.id)}
                                    onPhaseChange={(phaseId) => update(() => enrollmentModule.setStandaloneDrugPhase(drug.id, phaseId))}
                                    primaryColor={primaryColor}
                                    showImages={showImages}
                                    showDetails={showDetails}
                                    showPhases={showPhases}
                                    disabled={disabled}
                                    addOnPricing={state?.variant?.price != null ? { currency, bundleSize } : null}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {drugGroups.map((group: any) => {
                const selectedIds = enrollmentModule.getDrugGroupSelection(group.id);
                const selectedDrugs = group.drugs.filter((drug: any) => selectedIds.includes(drug.id));
                const selectedDrug = selectedDrugs[0] ?? null;
                const helperText =
                    group.description ||
                    (group.selection_type === 'multi'
                        ? 'Choose every alternative you want active in this group.'
                        : 'Review the selected drug, then switch medication or dosage only if needed.');

                return (
                    <Card key={group.id} className="border-border bg-card overflow-hidden">
                        <CardContent className="space-y-4 p-5">
                            <SectionHeader
                                icon={Pill}
                                title={group.name}
                                description={helperText}
                                primaryColor={primaryColor}
                                badge={
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                                            {group.selection_type === 'multi' ? 'Choose any' : 'Choose one'}
                                        </Badge>
                                        {group.is_required ? (
                                            <Badge
                                                className="rounded-full border-0 px-3 py-1 text-[11px] font-semibold"
                                                style={{
                                                    backgroundColor: withAlpha(primaryColor, 0.12),
                                                    color: primaryColor,
                                                }}
                                            >
                                                Required
                                            </Badge>
                                        ) : null}
                                    </div>
                                }
                            />

                            {group.selection_type === 'single' ? (
                                <SingleGroupSelectionCard
                                    group={group}
                                    selectedDrug={selectedDrug}
                                    selectedPhaseId={selectedDrug ? enrollmentModule.getGroupDrugPhase(group.id, selectedDrug.id) : null}
                                    onSelectDrug={(drugId) => update(() => enrollmentModule.setDrugGroupSelection(group.id, [drugId]))}
                                    onPhaseChange={(phaseId) => {
                                        if (!selectedDrug) {
                                            return;
                                        }

                                        update(() => enrollmentModule.setGroupDrugPhase(group.id, selectedDrug.id, phaseId));
                                    }}
                                    primaryColor={primaryColor}
                                    showImages={showImages}
                                    showDetails={showDetails}
                                    showPhases={showPhases}
                                    disabled={disabled}
                                    addOnPricing={state?.variant?.price != null ? { currency, bundleSize } : null}
                                />
                            ) : (
                                <MultiSelectGroupSection
                                    group={group}
                                    selectedDrugs={selectedDrugs}
                                    selectedDrugIds={selectedIds}
                                    enrollmentModule={enrollmentModule}
                                    update={update}
                                    primaryColor={primaryColor}
                                    showImages={showImages}
                                    showDetails={showDetails}
                                    showPhases={showPhases}
                                    disabled={disabled}
                                    addOnPricing={state?.variant?.price != null ? { currency, bundleSize } : null}
                                />
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {optionalDrugs.length > 0 ? (
                <Card className="border-border bg-card overflow-hidden">
                    <CardContent className="space-y-4 p-5">
                        <SectionHeader
                            icon={Plus}
                            title="Optional add-ons"
                            description="Add only the extra medications you want included with this plan."
                            primaryColor={primaryColor}
                        />

                        <div className="space-y-4">
                            {optionalDrugs.map((drug: any) => (
                                <OptionalDrugCard
                                    key={drug.id}
                                    drug={drug}
                                    isSelected={enrollmentModule.isOptionalDrugSelected(drug.id)}
                                    selectedPhaseId={enrollmentModule.getOptionalDrugPhase(drug.id)}
                                    onToggle={() => update(() => enrollmentModule.toggleOptionalDrug(drug.id))}
                                    onPhaseChange={(phaseId) => update(() => enrollmentModule.setOptionalDrugPhase(drug.id, phaseId))}
                                    primaryColor={primaryColor}
                                    showImages={showImages}
                                    showDetails={showDetails}
                                    showPhases={showPhases}
                                    currency={currency}
                                    price={enrollmentModule.getDrugPrice(drug) * bundleSize}
                                    disabled={disabled}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {showPricing && state ? <PricingSummary enrollmentModule={enrollmentModule} primaryColor={primaryColor} currency={currency} /> : null}
        </div>
    );
});

const MultiSelectGroupSection: React.FC<{
    group: any;
    selectedDrugs: any[];
    selectedDrugIds: number[];
    enrollmentModule: EnrollmentModule;
    update: (callback: () => void) => void;
    primaryColor: string;
    showImages: boolean;
    showDetails: boolean;
    showPhases: boolean;
    disabled?: boolean;
    addOnPricing?: { currency: string; bundleSize: number } | null;
}> = ({
    group,
    selectedDrugs,
    selectedDrugIds,
    enrollmentModule,
    update,
    primaryColor,
    showImages,
    showDetails,
    showPhases,
    disabled = false,
    addOnPricing,
}) => {
    const [isDrugChooserOpen, setIsDrugChooserOpen] = useState(false);

    const toggleDrug = (drugId: number) => {
        const isSelected = selectedDrugIds.includes(drugId);
        const isLockedRequiredSelection = group.is_required && selectedDrugIds.length === 1 && isSelected;

        if (disabled || isLockedRequiredSelection) {
            return;
        }

        const nextSelection = isSelected ? selectedDrugIds.filter((id) => id !== drugId) : [...selectedDrugIds, drugId];

        update(() => enrollmentModule.setDrugGroupSelection(group.id, nextSelection));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
                <ActionLink
                    primaryColor={primaryColor}
                    active={isDrugChooserOpen}
                    disabled={disabled}
                    onClick={() => setIsDrugChooserOpen((value) => !value)}
                >
                    Add/remove alternatives
                </ActionLink>
            </div>

            {selectedDrugs.length > 0 ? (
                <div className="space-y-4">
                    {selectedDrugs.map((drug) => (
                        <MultiGroupSelectedDrugCard
                            key={drug.id}
                            drug={drug}
                            selectedPhaseId={enrollmentModule.getGroupDrugPhase(group.id, drug.id)}
                            onPhaseChange={(phaseId) => update(() => enrollmentModule.setGroupDrugPhase(group.id, drug.id, phaseId))}
                            primaryColor={primaryColor}
                            showImages={showImages}
                            showDetails={showDetails}
                            showPhases={showPhases}
                            disabled={disabled}
                            addOnPricing={addOnPricing}
                        />
                    ))}
                </div>
            ) : (
                <MedicationSummaryCard
                    title="No alternatives selected"
                    imageUrl={null}
                    primaryColor={primaryColor}
                    showImages={showImages}
                    meta={[]}
                    description="Choose one or more drugs from this group to include them in the plan."
                    supportText={null}
                    summaryLabel="Status"
                    summaryValue="Nothing selected yet"
                    actions={
                        <ActionLink
                            primaryColor={primaryColor}
                            active={isDrugChooserOpen}
                            disabled={disabled}
                            onClick={() => setIsDrugChooserOpen((value) => !value)}
                        >
                            Add/remove alternatives
                        </ActionLink>
                    }
                />
            )}

            {isDrugChooserOpen ? (
                <MultiDrugChooser
                    group={group}
                    selectedDrugIds={selectedDrugIds}
                    onToggle={toggleDrug}
                    onDone={() => setIsDrugChooserOpen(false)}
                    primaryColor={primaryColor}
                    showImages={showImages}
                    showDetails={showDetails}
                    disabled={disabled}
                />
            ) : null}
        </div>
    );
};

EmrDrugSelectionRenderer.displayName = 'EmrDrugSelectionRenderer';

const EmrDrugSelectionBlock: BlockDefinition = {
    type: 'variant-selection',
    name: 'Treatment Variant Selection',
    description: 'Drug groups, standalone drugs, optional add-ons, titration phases, and pricing for EMR treatment plans',
    icon: <Pill className="h-4 w-4" />,
    defaultData: {
        type: 'variant-selection',
        fieldName: 'selectedVariation',
        showPricing: true,
        showTitrationPhases: true,
        showDrugDetails: true,
        showImages: true,
        required: true,
    },
    generateDefaultData: () => ({
        type: 'variant-selection',
        fieldName: 'selectedVariation',
        showPricing: true,
        showTitrationPhases: true,
        showDrugDetails: true,
        showImages: true,
        required: true,
    }),
    renderItem: (props) => <EmrDrugSelectionBlockItem {...props} />,
    renderFormFields: (props) => <EmrDrugSelectionBlockForm {...props} />,
    renderPreview: () => <EmrDrugSelectionBlockPreview />,
    renderBlock: (props) => <EmrDrugSelectionRenderer {...props} />,
    validate: (data) => {
        if (!data.fieldName) {
            return 'Field name is required';
        }

        return null;
    },
    validateValue: (value, data) => {
        if (!data?.required) {
            return null;
        }

        if (!value?.variantId) {
            return 'Please choose a plan to continue';
        }

        const missingRequiredGroup = value?.groupSelections?.find((group: any) => {
            const selectedCount = Array.isArray(group?.selectedDrugIds) ? group.selectedDrugIds.length : group?.selectedDrugId ? 1 : 0;

            return group?.isRequired && selectedCount === 0;
        });

        if (missingRequiredGroup) {
            return `Please choose an option for ${missingRequiredGroup.groupName}`;
        }

        return null;
    },
    outputSchema: {
        type: 'object',
        properties: {
            billingOptionId: { type: 'number', description: 'Selected prepaid billing option; null for pay per refill' },
            variantId: { type: 'string', description: 'Selected refill variant ID' },
            variantName: { type: 'string', description: 'Selected refill variant name' },
            variantPrice: { type: 'number', description: 'Variant base price' },
            scheduleLabel: { type: 'string', description: 'Selected plan cadence label' },
            scheduleType: { type: 'string', description: 'Schedule type' },
            standaloneDrugs: { type: 'array', description: 'Standalone drug selections with phase info' },
            groupSelections: { type: 'array', description: 'Drug group selections, including multi-select support and phase info' },
            optionalDrugs: { type: 'array', description: 'Selected optional drugs with prices' },
            total: { type: 'number', description: 'Total price' },
        },
    },
};

export default EmrDrugSelectionBlock;
