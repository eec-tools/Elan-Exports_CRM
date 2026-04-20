import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    // Try the modern Clipboard API first (works in secure contexts)
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Clipboard API failed, fall through to fallback
      }
    }

    // Fallback for non-secure contexts, older browsers, or when clipboard API fails
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Prevent scrolling on mobile
    textArea.style.position = "fixed";
    textArea.style.left = "0";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.setAttribute("readonly", ""); // Prevent keyboard on mobile

    // Append inside the active dialog (if any) to avoid Radix UI's focus trap
    // blocking selection of elements outside the dialog.
    const container =
      (document.activeElement?.closest('[role="dialog"]') as HTMLElement) ??
      document.body;
    container.appendChild(textArea);

    // iOS requires a different approach
    const isIOS = navigator.userAgent.match(/ipad|iphone/i);
    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.select();
    }

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed", err);
    }

    container.removeChild(textArea);
    return success;
  } catch (error) {
    console.error("Failed to copy to clipboard", error);
    return false;
  }
}
