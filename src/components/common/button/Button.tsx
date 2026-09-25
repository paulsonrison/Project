import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "save"
  | "cancel";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  danger: "btn btn-danger",
  save: "btn btn-save",
  cancel: "btn btn-cancel",
};

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  style,
  icon,
  iconPosition = "left",
  ...props
}: ButtonProps) {
  const mergedStyle: CSSProperties = {
    fontFamily: "'Libre Franklin', sans-serif",
    ...style,
  };

  const resolvedVariantClass = variantClasses[variant];
  const hasContent =
    children !== undefined && children !== null && children !== "";
  const hasIcon = Boolean(icon);
  const iconModifierClass = hasIcon
    ? variant === "ghost"
      ? "btn-icon btn-icon-edit"
      : "btn-icon"
    : "";

  return (
    <button
      type={type}
      className={[
        resolvedVariantClass,
        iconModifierClass,
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={mergedStyle}
      {...props}
    >
      {icon && iconPosition === "left" ? (
        <span className="inline-flex items-center justify-center">{icon}</span>
      ) : null}

      {hasContent ? <span>{children}</span> : null}

      {icon && iconPosition === "right" ? (
        <span className="inline-flex items-center justify-center">{icon}</span>
      ) : null}
    </button>
  );
}
