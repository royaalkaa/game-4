import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md border-2 border-line-strong font-semibold ' +
  'shadow-hard-sm transition duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  accent: 'bg-accent text-on-primary hover:bg-accent-hover',
  secondary: 'bg-surface text-fg hover:bg-surface-hover',
  danger: 'bg-surface text-danger hover:bg-danger-soft',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-14 px-6 py-3 text-lg',
};

function buttonClass(variant: Variant, size: Size, className = ''): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} data-button={variant} className={buttonClass(variant, size, className)} {...rest} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link data-button={variant} className={buttonClass(variant, size, className)} {...rest} />;
}
