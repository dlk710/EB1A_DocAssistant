import Link from "next/link";

export function SetuHomeLink(props: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={props.href ?? "/clients"}
      aria-label="Go to Setu home"
      className={["setu-wordmark", props.className].filter(Boolean).join(" ")}
    >
      <span className="setu-wordmark-letters">setu</span>
      <span className="setu-wordmark-deck" aria-hidden="true" />
    </Link>
  );
}
