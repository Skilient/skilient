import { cn } from "@/lib/cn";
import { objects, sources, type ObjectName } from "@/lib/marketing/objects";

/**
 * A rendered object (lib/marketing/objects.ts). Decorative unless `alt` is given. Themed objects
 * put both renders in the page, each hidden by the theme class, so the footer toggle picks the
 * image; lazy loading means the hidden one is never fetched.
 */
export function ObjectImage({
  name,
  alt = "",
  sizes,
  className,
  imgClassName,
  eager = false,
  priority = false,
}: {
  name: ObjectName;
  alt?: string;
  /** The `sizes` attribute when the object has more than one width. */
  sizes?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  priority?: boolean;
}) {
  const file = objects[name];
  const sets = file.shared ? [{ key: "shared", files: file.shared, cls: "block" }] : [
    { key: "light", files: file.light!, cls: "block dark:hidden" },
    { key: "dark", files: file.dark!, cls: "hidden dark:block" },
  ];
  return (
    <>
      {sets.map(({ key, files, cls }) => {
        const s = sources(files);
        return (
          <picture key={key} className={cn(cls, className)}>
            <source type="image/avif" srcSet={s.avifSet} sizes={sizes} />
            <img
              src={s.webp}
              srcSet={s.webpSet}
              sizes={sizes}
              alt={alt}
              width={file.w}
              height={file.h}
              loading={eager ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              draggable={false}
              className={cn("block h-auto w-full select-none", imgClassName)}
            />
          </picture>
        );
      })}
    </>
  );
}
