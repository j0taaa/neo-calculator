import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const numberFormatter = new Intl.NumberFormat("en-US")
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
})
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatDate(value: string | number | Date) {
  return dateFormatter.format(new Date(value))
}

export function formatDateTime(value: string | number | Date) {
  return dateTimeFormatter.format(new Date(value))
}
