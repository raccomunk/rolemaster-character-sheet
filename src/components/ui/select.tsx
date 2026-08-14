import React from "react";

type SelectProps = {
  value?: string;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
};

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
};

type SelectGroupProps = {
  label: string;
  children?: React.ReactNode;
};

function textFromNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ").trim();
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
}

function renderAsNativeOptions(node: React.ReactNode): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const et = child.type as any;
    if (et?.displayName === "SelectItem") {
      result.push(
        <option key={child.props.value} value={child.props.value}>
          {textFromNode(child.props.children)}
        </option>
      );
    } else if (et?.displayName === "SelectGroup") {
      const groupLabel = String((child.props as SelectGroupProps).label ?? "");
      result.push(
        <optgroup key={groupLabel} label={groupLabel}>
          {renderAsNativeOptions(child.props.children)}
        </optgroup>
      );
    } else if (et?.displayName !== "SelectLabel" && child.props?.children) {
      result.push(...renderAsNativeOptions(child.props.children));
    }
  });
  return result;
}

export function Select({ value = "", onValueChange, children }: SelectProps) {
  return (
    <select
      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {renderAsNativeOptions(children)}
    </select>
  );
}

export function SelectTrigger(_props: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

export function SelectValue(_props: { placeholder?: string }) {
  return null;
}

export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem(_props: SelectItemProps) {
  return null;
}
SelectItem.displayName = "SelectItem";

export function SelectGroup(_props: SelectGroupProps) {
  return null;
}
SelectGroup.displayName = "SelectGroup";

export function SelectLabel(_props: { children?: React.ReactNode }) {
  return null;
}
SelectLabel.displayName = "SelectLabel";
