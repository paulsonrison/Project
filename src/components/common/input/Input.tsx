import type { InputHTMLAttributes } from "react";

type TextFieldVariant = "default" | "cell";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: TextFieldVariant;
  labelClassName?: string;
  containerClassName?: string;
}

export default function Input({
  label,
  error,
  variant = "default",
  className = "",
  labelClassName = "",
  containerClassName = "",
  ...props
}: TextFieldProps) {
  const inputClass = variant === "cell" ? "input-cell" : "input";
  const classes = [inputClass, className].filter(Boolean).join(" ");
  const labelClasses = ["field-label", labelClassName].filter(Boolean).join(" ");
  const containerClasses = ["field", containerClassName].filter(Boolean).join(" ");

  return (
    <label className={containerClasses}>
      {label ? <span className={labelClasses}>{label}</span> : null}
      <input {...props} className={classes} />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
