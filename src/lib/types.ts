export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  company?: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string | null;
  sampleValues: string[];
  confidence: number;
}

export const REQUIRED_FIELDS = [
  "clientName",
  "phoneNumber",
] as const;

export const OPTIONAL_FIELDS = [
  "referenceId",
  "debtValueSar",
  "debtAgeDays",
  "companyName",
] as const;

export const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;
export type DebtorField = (typeof ALL_FIELDS)[number];

export const FIELD_LABELS: Record<DebtorField, { en: string; ar: string }> = {
  clientName: { en: "Client Name", ar: "اسم العميل" },
  phoneNumber: { en: "Phone Number", ar: "رقم الجوال" },
  referenceId: { en: "Reference ID", ar: "رقم المرجع" },
  debtValueSar: { en: "Debt Amount (SAR)", ar: "مبلغ الدين (ريال)" },
  debtAgeDays: { en: "Debt Age (Days)", ar: "عمر الدين (أيام)" },
  companyName: { en: "Company Name", ar: "اسم الشركة" },
};
