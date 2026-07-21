import { waLink, telLink } from "@/lib/whatsapp";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/*
 * PhoneLink — a phone number is never just text.
 *
 * Wherever a number appears in this product, it is one tap from a call and one
 * tap from a WhatsApp thread. The desk does this two hundred times a day, so
 * the affordance is always present rather than hidden behind a row menu; it
 * simply stays quiet until the row is hovered.
 */

export function PhoneLink({
  phone,
  message,
  className,
  showActions = true,
}: {
  phone: string;
  /** Pre-filled first message for the WhatsApp thread. */
  message?: string;
  className?: string;
  showActions?: boolean;
}) {
  if (!phone) return <span className="text-muted-2">—</span>;

  return (
    <span className={cn("group/phone inline-flex items-center gap-1.5 min-w-0", className)}>
      <span className="font-mono text-[12px] truncate">{phone}</span>
      {showActions && (
        <span className="inline-flex items-center gap-0.5 opacity-0 group-hover/phone:opacity-100 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconAction
            href={telLink(phone)}
            label={`Call ${phone}`}
            icon="phone"
          />
          <IconAction
            href={waLink(phone, message)}
            label={`WhatsApp ${phone}`}
            icon="message"
            external
          />
        </span>
      )}
    </span>
  );
}

/** Standalone WhatsApp button for toolbars and contact cards. */
export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  className,
}: {
  phone: string;
  message?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={waLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-md",
        "border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border transition-colors",
        className,
      )}
    >
      <Icon name="message" size={13} />
      {label}
    </a>
  );
}

function IconAction({
  href,
  label,
  icon,
  external,
}: {
  href: string;
  label: string;
  icon: "phone" | "message";
  external?: boolean;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="w-[22px] h-[22px] grid place-items-center rounded-[5px] text-muted-2 hover:text-primary hover:bg-primary-tint transition-colors"
    >
      <Icon name={icon} size={12} strokeWidth={1.5} />
    </a>
  );
}
