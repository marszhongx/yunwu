import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
};

export function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  multiline = false,
}: FieldProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange(event.target.value);

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      {type === "password" ? (
        <PasswordInput id={id} placeholder={placeholder} value={value} onChange={handleChange} />
      ) : multiline ? (
        <Textarea id={id} placeholder={placeholder} value={value} onChange={handleChange} />
      ) : (
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
        />
      )}
    </div>
  );
}
