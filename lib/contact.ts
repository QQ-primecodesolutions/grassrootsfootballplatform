/** PrimeCode Solutions contact details shown on the public homepage. */

/** WhatsApp number in international format, without "+" (wa.me needs this): 067 209 2558. */
export const CONTACT_WHATSAPP = "27672092558";
export const CONTACT_WHATSAPP_DISPLAY = "067 209 2558";

/** A wa.me "click to chat" link that opens a chat with the number and a ready message. */
export function whatsappChatUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
