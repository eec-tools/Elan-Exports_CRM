import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  try {
    // Try the modern Clipboard API first
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for non-secure contexts or older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea out of sight but still part of the DOM and "visible" enough for some browsers
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed", err);
      success = false;
    }
    
    document.body.removeChild(textArea);
    return success;
  } catch (error) {
    console.error("Failed to copy to clipboard", error);
    return false;
  }
}
