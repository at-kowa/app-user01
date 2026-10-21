"use client";

// 入力欄：書き終えたとき（欄を離れる・Enter）に1回だけ確定する。打っている途中では確定しない
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { md } from "@/lib/board/logic";
import { cn } from "@/lib/utils";

const inputCls = "h-10 bg-white text-[15px] md:text-[15px]";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

export function ReadValue({ value, date }: { value: string | number; date?: boolean }) {
  const v = date ? md(String(value)) : value === "" ? "—" : value;
  return <span className="min-h-7 text-[15px] text-ink">{v}</span>;
}

export function CommitText({
  value,
  onCommit,
  required,
  ariaLabel,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Input
      key={value}
      type="text"
      defaultValue={value}
      aria-label={ariaLabel}
      className={cn(inputCls, className)}
      onBlur={(e) => {
        const v = e.currentTarget.value;
        if (required && !v.trim()) {
          e.currentTarget.value = value; // 空にはできない＝元に戻す
          return;
        }
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function CommitNumber({ value, onCommit, ariaLabel }: { value: number | ""; onCommit: (v: number | "") => void; ariaLabel?: string }) {
  return (
    <Input
      key={String(value)}
      type="number"
      min={0}
      inputMode="numeric"
      defaultValue={value}
      aria-label={ariaLabel}
      className={inputCls}
      onBlur={(e) => {
        const raw = e.currentTarget.value;
        const v = raw === "" ? "" : Number(raw);
        if (v !== "" && (Number.isNaN(v) || v < 0)) {
          e.currentTarget.value = String(value);
          return;
        }
        if (String(v) !== String(value)) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function CommitDate({ value, onCommit, ariaLabel }: { value: string; onCommit: (v: string) => void; ariaLabel?: string }) {
  return (
    <Input
      key={value}
      type="date"
      defaultValue={value}
      aria-label={ariaLabel}
      className={inputCls}
      onBlur={(e) => {
        const v = e.currentTarget.value;
        if (v !== value) onCommit(v);
      }}
    />
  );
}

export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  className,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <NativeSelect
      id={id}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={cn("w-full [&_select]:h-10 [&_select]:bg-white [&_select]:text-[15px]", className)}
    >
      {options.map((o) => (
        <NativeSelectOption key={o} value={o}>
          {o}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
