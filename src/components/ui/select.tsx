import React from "react";

type SelectItemData = {
  value: string;
  label: string;
};

type SelectProps = {
  value?: string;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
};

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
};

function textFromNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ").trim();
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
}

function collectItems(node: React.ReactNode, items: SelectItemData[]): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const elementType = child.type as any;
    if (elementType?.displayName === "SelectItem") {
      items.push({
        value: String(child.props.value),
        label: textFromNode(child.props.children) || String(child.props.value),
      });
    }
    if (child.props?.children) collectItems(child.props.children, items);
  });
}

export function Select({ value = "", onValueChange, children }: SelectProps) {
  const items: SelectItemData[] = [];
  collectItems(children, items);

  return (
    <select
      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
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
