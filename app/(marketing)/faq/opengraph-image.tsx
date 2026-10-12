import { ogContentType, ogImage, ogSize } from "@/lib/og/image";
import { faqPage } from "@/content/marketing";

export const alt = faqPage.headline;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage(faqPage.headline, faqPage.title);
}
