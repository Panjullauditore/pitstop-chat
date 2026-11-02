import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escapeHtml(value: string): string {
  return String(value || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] || c));
}

let dateLanguage: 'en'|'id'='en';
export function setDateLanguage(language:'en'|'id'){dateLanguage=language;}
export function formatJakartaDate(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  try {
    return (
      new Intl.DateTimeFormat(dateLanguage==='id'?"id-ID":"en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value)) + " WIB"
    );
  } catch {
    return String(value);
  }
}
