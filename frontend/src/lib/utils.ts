import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Path alias resolver for imports
export const resolveImportPath = (path: string) => {
  if (path.startsWith('@/')) {
    return path.replace('@/', '/src/')
  }
  return path
}
