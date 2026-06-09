import { useTranslation } from "react-i18next";
import type { NormalizedRegistrationField } from "@shared/registrationFields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface RegistrationFieldInputProps {
  field: NormalizedRegistrationField;
  value: string | boolean;
  disabled?: boolean;
  onValueChange: (fieldKey: string, value: string | boolean) => void;
  onBlur?: (fieldKey: string) => void;
}

export default function RegistrationFieldInput({
  field,
  value,
  disabled,
  onValueChange,
  onBlur,
}: RegistrationFieldInputProps) {
  const { t } = useTranslation();
  const options = field.options_json ?? [];

  if (field.field_type === "file") {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        {t("registrationWizard.checkout.fileNotSupported")}
      </p>
    );
  }

  if (field.field_type === "select") {
    if (options.length === 0) {
      return (
        <Input
          disabled={disabled}
          className="bg-surface-dark border-gray-700"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onValueChange(field.field_key, e.target.value)}
          onBlur={() => onBlur?.(field.field_key)}
        />
      );
    }
    const selected =
      typeof value === "string" && value.trim() ? value.trim() : undefined;
    return (
      <Select
        disabled={disabled}
        value={selected}
        onValueChange={(v) => onValueChange(field.field_key, v)}
      >
        <SelectTrigger
          className="bg-surface-dark border-gray-700"
          onBlur={() => onBlur?.(field.field_key)}
        >
          <SelectValue placeholder={t("registrationWizard.checkout.selectOption")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <div className="flex items-start gap-2">
        <Checkbox
          id={`reg-field-${field.field_key}`}
          disabled={disabled}
          checked={Boolean(value)}
          onCheckedChange={(c) => onValueChange(field.field_key, c === true)}
          onBlur={() => onBlur?.(field.field_key)}
        />
        <Label
          htmlFor={`reg-field-${field.field_key}`}
          className="text-sm text-gray-400 leading-snug cursor-pointer"
        >
          {field.label}
          {field.is_required ? " *" : ""}
        </Label>
      </div>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <Textarea
        disabled={disabled}
        className="bg-surface-dark border-gray-700 min-h-[80px]"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onValueChange(field.field_key, e.target.value)}
        onBlur={() => onBlur?.(field.field_key)}
      />
    );
  }

  const inputType =
    field.field_type === "number"
      ? "number"
      : field.field_type === "date"
        ? "date"
        : "text";

  return (
    <Input
      disabled={disabled}
      type={inputType}
      className="bg-surface-dark border-gray-700"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onValueChange(field.field_key, e.target.value)}
      onBlur={() => onBlur?.(field.field_key)}
    />
  );
}
